// Query Element84 Earth Search STAC API for the latest Sentinel-2 satellite pass date
// Free, no auth required — returns actual acquisition timestamps from Sentinel-2

const imageryDateCache = new Map<string, { date: string | null; fetchedAt: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

function cacheKey(lat: number, lng: number): string {
  // Round to 1 decimal (~11km) to group nearby queries
  return `${lat.toFixed(1)},${lng.toFixed(1)}`
}

export async function getImageryDate(lat: number, lng: number): Promise<string | null> {
  const key = cacheKey(lat, lng)

  const cached = imageryDateCache.get(key)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.date
  }

  try {
    // Search Element84 Earth Search STAC for the most recent Sentinel-2 image
    // covering this location with low cloud cover
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch("https://earth-search.aws.element84.com/v1/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        collections: ["sentinel-2-l2a"],
        intersects: {
          type: "Point",
          coordinates: [lng, lat], // GeoJSON: [lng, lat]
        },
        sortby: [{ field: "properties.datetime", direction: "desc" }],
        limit: 1,
        query: {
          "eo:cloud_cover": { lt: 30 },
        },
      }),
    })
    clearTimeout(timeout)

    if (!response.ok) {
      imageryDateCache.set(key, { date: null, fetchedAt: Date.now() })
      return null
    }

    const data = await response.json()

    let srcDate: string | null = null

    if (data.features && data.features.length > 0) {
      const feature = data.features[0]
      const datetime = feature.properties?.datetime
      if (datetime) {
        srcDate = datetime.slice(0, 10) // "2026-03-04T08:21:34Z" → "2026-03-04"
      }
    }

    imageryDateCache.set(key, { date: srcDate, fetchedAt: Date.now() })
    return srcDate
  } catch {
    imageryDateCache.set(key, { date: null, fetchedAt: Date.now() })
    return null
  }
}

/**
 * Compare event time with latest satellite pass date and return freshness status
 */
export function getImageryFreshness(
  eventTimestamp: number,
  imageryDateStr: string | null
): { status: "fresh" | "outdated" | "unknown"; label: string; daysOld?: number } {
  if (!imageryDateStr) {
    return { status: "unknown", label: "NO SAT DATA" }
  }

  const imageryDate = Date.parse(imageryDateStr)
  if (isNaN(imageryDate)) {
    return { status: "unknown", label: "NO SAT DATA" }
  }

  const eventDate = eventTimestamp || Date.now()
  const diffMs = eventDate - imageryDate
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 5) {
    return { status: "fresh", label: "RECENT PASS", daysOld: diffDays }
  }
  if (diffDays <= 30) {
    return { status: "fresh", label: "SAT COVERAGE OK", daysOld: diffDays }
  }

  return { status: "outdated", label: "OLD COVERAGE", daysOld: diffDays }
}
