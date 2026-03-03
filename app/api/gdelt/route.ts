import { NextRequest, NextResponse } from "next/server"
import { parseGdeltGeoJSON } from "@/lib/gdelt"

// GDELT GEO 2.0 API - free, no auth needed, 15-min updates
// Returns GeoJSON with geocoded event locations from global news
const GDELT_GEO_URL = "https://api.gdeltproject.org/api/v2/geo/geo"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("query") || "conflict OR attack OR explosion OR missile OR airstrike"
  const timespan = searchParams.get("timespan") || "60" // minutes

  try {
    const url = `${GDELT_GEO_URL}?query=${encodeURIComponent(query)}&format=GeoJSON&timespan=${timespan}&maxpoints=250`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(url, {
      next: { revalidate: 300 }, // cache 5 min (GDELT updates every 15 min)
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      console.warn(`GDELT API returned ${response.status}`)
      return NextResponse.json({ events: [], count: 0 })
    }

    const data = await response.json()
    const events = parseGdeltGeoJSON(data)

    return NextResponse.json({
      count: events.length,
      events,
    })
  } catch (error) {
    console.error("GDELT fetch error:", error)
    return NextResponse.json({ events: [], count: 0 })
  }
}
