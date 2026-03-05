// Query Element84 Earth Search STAC API for satellite passes AFTER an event
// Free, no auth required — returns actual Sentinel-2 acquisition timestamps

const imageryDateCache = new Map<string, { date: string | null; fetchedAt: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

function cacheKey(lat: number, lng: number, eventTs: number): string {
  // Round coords to 1 decimal (~11km), event date to day
  const day = new Date(eventTs).toISOString().slice(0, 10)
  return `${lat.toFixed(1)},${lng.toFixed(1)},${day}`
}

/**
 * Find the first Sentinel-2 pass AFTER the event timestamp for this location.
 * This tells us: "is there a satellite image available that shows the aftermath?"
 */
export async function getImageryDate(
  lat: number,
  lng: number,
  eventTimestamp: number
): Promise<string | null> {
  const key = cacheKey(lat, lng, eventTimestamp)

  const cached = imageryDateCache.get(key)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.date
  }

  try {
    const eventDate = new Date(eventTimestamp).toISOString()
    const now = new Date().toISOString()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    // Search for Sentinel-2 images AFTER the event with low cloud cover
    const response = await fetch("https://earth-search.aws.element84.com/v1/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        collections: ["sentinel-2-l2a"],
        intersects: {
          type: "Point",
          coordinates: [lng, lat],
        },
        datetime: `${eventDate}/${now}`,
        sortby: [{ field: "properties.datetime", direction: "asc" }],
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
        srcDate = datetime.slice(0, 10)
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
 * Check if there's a satellite image available AFTER the event
 */
export function getImageryFreshness(
  eventTimestamp: number,
  imageryDateStr: string | null
): { status: "fresh" | "outdated" | "unknown"; label: string; daysAgo?: number } {
  if (!imageryDateStr) {
    return { status: "unknown", label: "NO POST-EVENT IMAGE" }
  }

  const imageryDate = Date.parse(imageryDateStr)
  if (isNaN(imageryDate)) {
    return { status: "unknown", label: "NO POST-EVENT IMAGE" }
  }

  // How many days after the event did the satellite pass?
  const diffMs = imageryDate - eventTimestamp
  const daysAfter = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // How old is the satellite image from now?
  const ageMs = Date.now() - imageryDate
  const daysAgo = Math.floor(ageMs / (1000 * 60 * 60 * 24))

  if (daysAfter <= 1) {
    return { status: "fresh", label: "IMAGE AVAILABLE", daysAgo }
  }
  if (daysAfter <= 5) {
    return { status: "fresh", label: "IMAGE AVAILABLE", daysAgo }
  }

  return { status: "outdated", label: "WAITING FOR PASS", daysAgo }
}
