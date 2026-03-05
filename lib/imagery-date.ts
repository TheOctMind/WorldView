// Query Esri World Imagery MapServer for the satellite capture date at a given location
// Uses the identify endpoint which returns metadata including SRC_DATE

const imageryDateCache = new Map<string, { date: string | null; fetchedAt: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

function cacheKey(lat: number, lng: number): string {
  // Round to 2 decimals (~1km) to avoid too many unique queries
  return `${lat.toFixed(2)},${lng.toFixed(2)}`
}

export async function getImageryDate(lat: number, lng: number): Promise<string | null> {
  const key = cacheKey(lat, lng)

  const cached = imageryDateCache.get(key)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.date
  }

  try {
    // Build a small bounding box around the point for the identify request
    const delta = 0.01
    const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`

    const url = `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/identify` +
      `?geometry=${lng},${lat}` +
      `&geometryType=esriGeometryPoint` +
      `&sr=4326` +
      `&layers=all:0` +
      `&tolerance=2` +
      `&mapExtent=${bbox}` +
      `&imageDisplay=256,256,96` +
      `&returnGeometry=false` +
      `&f=json`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!response.ok) {
      imageryDateCache.set(key, { date: null, fetchedAt: Date.now() })
      return null
    }

    const data = await response.json()

    // The identify response has "results" array with "attributes"
    // Look for SRC_DATE or SRC_DATE2 in attributes
    let srcDate: string | null = null

    if (data.results && data.results.length > 0) {
      const attrs = data.results[0].attributes || {}
      // Try common attribute names for imagery date
      const dateVal = attrs.SRC_DATE || attrs.SRC_DATE2 || attrs.SRC_RES || attrs.AcquisitionDate || null
      if (dateVal) {
        // Could be epoch ms or a date string
        if (typeof dateVal === "number" && dateVal > 1e12) {
          srcDate = new Date(dateVal).toISOString().slice(0, 10)
        } else if (typeof dateVal === "number" && dateVal > 19000000) {
          // Format: 20230815 (YYYYMMDD)
          const s = String(dateVal)
          srcDate = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
        } else if (typeof dateVal === "string" && dateVal.length >= 8) {
          // Try to parse as date string
          const parsed = Date.parse(dateVal)
          if (!isNaN(parsed)) {
            srcDate = new Date(parsed).toISOString().slice(0, 10)
          } else {
            srcDate = dateVal
          }
        }
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
 * Compare event time with imagery date and return freshness status
 */
export function getImageryFreshness(
  eventTimestamp: number,
  imageryDateStr: string | null
): { status: "fresh" | "outdated" | "unknown"; label: string; daysOld?: number } {
  if (!imageryDateStr) {
    return { status: "unknown", label: "IMAGERY DATE UNKNOWN" }
  }

  const imageryDate = Date.parse(imageryDateStr)
  if (isNaN(imageryDate)) {
    return { status: "unknown", label: "IMAGERY DATE UNKNOWN" }
  }

  const eventDate = eventTimestamp || Date.now()
  const diffMs = eventDate - imageryDate
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 30) {
    return { status: "fresh", label: "IMAGERY UP TO DATE", daysOld: diffDays }
  }

  return { status: "outdated", label: "IMAGERY OUTDATED", daysOld: diffDays }
}
