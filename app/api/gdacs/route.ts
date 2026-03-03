import { NextRequest, NextResponse } from "next/server"
import { parseGdacsResponse } from "@/lib/gdacs"

// GDACS REST API - free, no auth, global disaster alerts
// Returns GeoJSON with current disasters (earthquakes, cyclones, floods, volcanoes)
const GDACS_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const alertLevel = searchParams.get("alertLevel") || "Red;Orange;Green"
  const eventTypes = searchParams.get("eventTypes") || "EQ,TC,FL,VO,WF"

  try {
    // Calculate date range: last 30 days to today
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const fromDate = thirtyDaysAgo.toISOString().split("T")[0]
    const toDate = now.toISOString().split("T")[0]

    const url = `${GDACS_URL}?eventlist=${eventTypes}&fromDate=${fromDate}&toDate=${toDate}&alertlevel=${alertLevel}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(url, {
      next: { revalidate: 600 }, // cache 10 min
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    })
    clearTimeout(timeout)

    if (!response.ok) {
      console.warn(`GDACS API returned ${response.status}`)
      return NextResponse.json({ alerts: [], count: 0 })
    }

    const data = await response.json()
    const alerts = parseGdacsResponse(data)

    return NextResponse.json({
      count: alerts.length,
      alerts,
    })
  } catch (error) {
    console.error("GDACS fetch error:", error)
    return NextResponse.json({ alerts: [], count: 0 })
  }
}
