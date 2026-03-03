import { NextRequest, NextResponse } from "next/server"
import { parseUSGSGeoJSON } from "@/lib/seismic"

// In-memory cache for faster responses on repeated requests
let cachedResult: { data: any; timestamp: number; key: string } | null = null
const CACHE_TTL = 60 * 1000 // 60 seconds

// USGS real-time earthquake GeoJSON feeds (updated every minute)
// https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
const FEEDS: Record<string, string> = {
  hour: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
  day: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
  significant: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson",
}

// Region bounding boxes for filtering
const REGIONS: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  iran: { minLat: 25, maxLat: 40, minLng: 44, maxLng: 63 },
  middle_east: { minLat: 12, maxLat: 42, minLng: 24, maxLng: 63 },
  world: { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 },
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const feed = searchParams.get("feed") || "day"
  const region = searchParams.get("region") || "middle_east"

  const cacheKey = `${feed}-${region}`
  if (cachedResult && cachedResult.key === cacheKey && Date.now() - cachedResult.timestamp < CACHE_TTL) {
    return NextResponse.json(cachedResult.data, {
      headers: { "X-Cache": "HIT" },
    })
  }

  try {
    const url = FEEDS[feed] || FEEDS.day
    const response = await fetch(url, { next: { revalidate: 30 } })

    if (!response.ok) {
      return NextResponse.json(
        { error: `USGS API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    let events = parseUSGSGeoJSON(data)

    // Filter by region
    const bounds = REGIONS[region] || REGIONS.middle_east
    if (region !== "world") {
      events = events.filter(
        (e) =>
          e.latitude >= bounds.minLat &&
          e.latitude <= bounds.maxLat &&
          e.longitude >= bounds.minLng &&
          e.longitude <= bounds.maxLng
      )
    }

    // Flag shallow events as potentially explosion-related
    // Explosions typically have depth < 5km and type may be "explosion"
    const flagged = events.map((e) => ({
      ...e,
      suspicious: e.depth < 5 || e.type === "explosion" || e.type === "nuclear explosion",
    }))

    const responseData = {
      count: flagged.length,
      suspicious: flagged.filter((e) => e.suspicious).length,
      events: flagged,
    }

    cachedResult = { data: responseData, timestamp: Date.now(), key: cacheKey }

    return NextResponse.json(responseData, {
      headers: { "X-Cache": "MISS" },
    })
  } catch (error) {
    console.error("USGS fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch USGS data" }, { status: 500 })
  }
}
