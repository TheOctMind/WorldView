import { NextRequest, NextResponse } from "next/server"
import { parseFireCSV, type FirmsHotspot, type Classification } from "@/lib/firms"
import { readFileSync, writeFileSync, existsSync, statSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

// In-memory cache to avoid re-fetching 15MB+ of CSV on every request
// Keyed by query params so different requests don't share stale data
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const FILE_CACHE_TTL = 15 * 60 * 1000 // 15 minutes for disk cache

function cacheKey(source: string, days: string, region: string): string {
  return `${source}:${days}:${region}`
}

function fileCachePath(key: string): string {
  // Sanitize key for filename
  return join(tmpdir(), `satzon-firms-cache-${key.replace(/[^a-z0-9]/gi, "_")}.json`)
}

// Try to load from disk cache on cold start
function loadDiskCache(key: string): { data: any; timestamp: number } | null {
  try {
    const path = fileCachePath(key)
    if (!existsSync(path)) return null
    const stat = statSync(path)
    if (Date.now() - stat.mtimeMs > FILE_CACHE_TTL) return null
    const raw = readFileSync(path, "utf-8")
    const parsed = JSON.parse(raw)
    return { data: parsed, timestamp: stat.mtimeMs }
  } catch {
    return null
  }
}

function saveDiskCache(key: string, data: any): void {
  try {
    writeFileSync(fileCachePath(key), JSON.stringify(data))
  } catch {
    // Disk write failure is non-critical
  }
}

// All NRT satellite sources to poll in parallel via FIRMS JSON API
const ALL_SOURCES = [
  "VIIRS_SNPP_NRT",
  "VIIRS_NOAA20_NRT",
  "VIIRS_NOAA21_NRT",
  "MODIS_NRT",
]

// NIFC ArcGIS - free backup source, no API key needed
function nifcUrl(days: number): string {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const where = encodeURIComponent(`acq_date >= '${since}'`)
  return `https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/Satellite_VIIRS_Thermal_Hotspots_and_Fire_Activity/FeatureServer/0/query?where=${where}&outFields=latitude,longitude,bright_ti4,bright_ti5,confidence,acq_date,acq_time,satellite,frp,daynight,scan,track&outSR=4326&f=json&resultRecordCount=16000`
}

function classifyHotspot(h: FirmsHotspot): Classification {
  const isHighConf = h.confidence.toLowerCase() === "high" || parseInt(h.confidence) > 80
  const isNight = h.daynight === "N"

  if (
    h.frp > 300 ||
    (h.bright_ti4 > 400 && h.frp > 50) ||
    (h.bright_ti4 > 367 && h.frp > 100 && isHighConf) ||
    (h.frp > 200 && isHighConf && isNight)
  ) {
    return "launch_suspect"
  }

  if (
    h.frp > 50 ||
    h.bright_ti4 > 350 ||
    (h.bright_ti4 > 340 && isHighConf) ||
    (h.frp > 30 && isHighConf && isNight)
  ) {
    return "high_intensity"
  }

  return "fire"
}

function deduplicateHotspots(hotspots: FirmsHotspot[]): FirmsHotspot[] {
  const seen = new Map<string, FirmsHotspot>()

  for (const h of hotspots) {
    const key = `${h.latitude.toFixed(4)},${h.longitude.toFixed(4)},${h.acq_date},${h.acq_time}`
    const existing = seen.get(key)
    if (!existing || h.frp > existing.frp) {
      seen.set(key, h)
    }
  }

  return Array.from(seen.values())
}

// Parse NIFC ArcGIS response into our hotspot format
function parseNIFC(data: { features?: { attributes: Record<string, unknown> }[] }): FirmsHotspot[] {
  if (!data.features) return []
  return data.features.map((f) => {
    const a = f.attributes
    // NIFC acq_date can be a Unix timestamp (ms) or a date string
    let acqDate = ""
    let acqTime = ""
    const rawDate = a.acq_date
    if (typeof rawDate === "number" && rawDate > 1e12) {
      const d = new Date(rawDate)
      acqDate = d.toISOString().slice(0, 10)
      acqTime = d.toISOString().slice(11, 13) + d.toISOString().slice(14, 16)
    } else {
      acqDate = String(rawDate || "")
      acqTime = String(a.acq_time || "")
    }
    return {
      latitude: (a.latitude as number) || 0,
      longitude: (a.longitude as number) || 0,
      bright_ti4: (a.bright_ti4 as number) || 0,
      bright_ti5: (a.bright_ti5 as number) || 0,
      confidence: String(a.confidence || "nominal"),
      acq_date: acqDate,
      acq_time: acqTime,
      satellite: String(a.satellite || "VIIRS"),
      frp: (a.frp as number) || 0,
      daynight: String(a.daynight || ""),
      version: "",
      scan: (a.scan as number) || 0,
      track: (a.track as number) || 0,
      source: "NIFC",
    }
  }).filter((h) => !isNaN(h.latitude) && !isNaN(h.longitude) && h.latitude !== 0)
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const source = searchParams.get("source") || "all"
  const days = searchParams.get("days") || "2"
  const region = searchParams.get("region") || "world"

  const mapKey = process.env.FIRMS_MAP_KEY
  if (!mapKey) {
    return NextResponse.json({ error: "FIRMS_MAP_KEY not configured" }, { status: 500 })
  }

  const ck = cacheKey(source, days, region)

  // Return cached result if fresh (avoids re-downloading 15MB+ of CSV)
  const cachedResult = cache.get(ck)
  if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
    return NextResponse.json(cachedResult.data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "X-Cache": "HIT",
      },
    })
  }

  // Fallback: try disk cache on cold start (survives server restarts)
  if (!cachedResult) {
    const diskData = loadDiskCache(ck)
    if (diskData) {
      cache.set(ck, diskData)
      return NextResponse.json(diskData.data, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "X-Cache": "DISK",
        },
      })
    }
  }

  try {
    const area = region === "world" ? "world" : region
    const sources = source === "all" ? ALL_SOURCES : [source]

    // Fetch FIRMS CSV + NIFC backup in parallel
    const firmsFetches = sources.map(async (src) => {
      const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${src}/${area}/${days}`
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const response = await fetch(url, { cache: "no-store", signal: controller.signal })
      clearTimeout(timeout)
      if (!response.ok) {
        console.warn(`FIRMS ${src} returned ${response.status}`)
        return { source: src, hotspots: [] as FirmsHotspot[] }
      }
      const csv = await response.text()
      // Verify we got CSV, not an HTML error page
      if (csv.startsWith("<!") || csv.startsWith("<html")) {
        console.warn(`FIRMS ${src} returned HTML instead of CSV`)
        return { source: src, hotspots: [] as FirmsHotspot[] }
      }
      return { source: src, hotspots: parseFireCSV(csv, src) }
    })

    const nifcFetch = fetch(nifcUrl(parseInt(days)), { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data ? parseNIFC(data) : [])
      .catch(() => [] as FirmsHotspot[])

    const [firmsResults, nifcHotspots] = await Promise.all([
      Promise.allSettled(firmsFetches),
      nifcFetch,
    ])

    let allHotspots: FirmsHotspot[] = []
    const sourcesUsed: string[] = []

    for (const result of firmsResults) {
      if (result.status === "fulfilled" && result.value.hotspots.length > 0) {
        allHotspots.push(...result.value.hotspots)
        sourcesUsed.push(result.value.source)
      }
    }

    // Add NIFC data
    if (nifcHotspots.length > 0) {
      allHotspots.push(...nifcHotspots)
      sourcesUsed.push("NIFC")
    }

    // Deduplicate overlapping detections from multiple sources
    allHotspots = deduplicateHotspots(allHotspots)

    // Classify each hotspot
    const classified = allHotspots.map((h) => ({
      ...h,
      classification: classifyHotspot(h),
    }))

    // Sort by time (newest first) so client event log doesn't need to re-sort 50k+ items
    classified.sort((a, b) => {
      // Primary: by acq_date + acq_time descending (newest first)
      const dateComp = b.acq_date.localeCompare(a.acq_date)
      if (dateComp !== 0) return dateComp
      const timeComp = (b.acq_time || "0000").localeCompare(a.acq_time || "0000")
      if (timeComp !== 0) return timeComp
      // Tiebreaker: severity then FRP
      const order: Record<string, number> = { launch_suspect: 0, high_intensity: 1, fire: 2 }
      return (order[a.classification] || 2) - (order[b.classification] || 2) || b.frp - a.frp
    })

    let launchSuspects = 0
    let highIntensity = 0
    for (const h of classified) {
      if (h.classification === "launch_suspect") launchSuspects++
      else if (h.classification === "high_intensity") highIntensity++
    }

    const responseData = {
      count: classified.length,
      launchSuspects,
      highIntensity,
      sourcesUsed,
      region,
      days: parseInt(days),
      hotspots: classified,
    }

    // Cache in memory for 5 min + persist to disk for cold starts
    cache.set(ck, { data: responseData, timestamp: Date.now() })
    saveDiskCache(ck, responseData)

    return NextResponse.json(responseData, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "X-Cache": "MISS",
      },
    })
  } catch (error) {
    console.error("FIRMS fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch FIRMS data" }, { status: 500 })
  }
}
