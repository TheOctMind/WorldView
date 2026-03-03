export type Classification = "launch_suspect" | "high_intensity" | "fire"

export interface FirmsHotspot {
  latitude: number
  longitude: number
  bright_ti4: number
  bright_ti5: number
  confidence: string
  acq_date: string
  acq_time: string
  satellite: string
  frp: number
  daynight: string
  version: string
  scan: number
  track: number
  source: string
  classification?: Classification
}

export function parseFireCSV(csv: string, sourceLabel: string): FirmsHotspot[] {
  const lines = csv.trim().split("\n")
  if (lines.length < 2) return []

  const headers = lines[0].split(",")
  const idx = (name: string) => headers.indexOf(name)

  // VIIRS uses bright_ti4/bright_ti5, MODIS uses brightness/bright_t31
  const bt4Idx = idx("bright_ti4") !== -1 ? idx("bright_ti4") : idx("brightness")
  const bt5Idx = idx("bright_ti5") !== -1 ? idx("bright_ti5") : idx("bright_t31")

  return lines.slice(1).map((line) => {
    const cols = line.split(",")
    return {
      latitude: parseFloat(cols[idx("latitude")]),
      longitude: parseFloat(cols[idx("longitude")]),
      bright_ti4: parseFloat(cols[bt4Idx]) || 0,
      bright_ti5: parseFloat(cols[bt5Idx]) || 0,
      confidence: cols[idx("confidence")] || "nominal",
      acq_date: cols[idx("acq_date")] || "",
      acq_time: cols[idx("acq_time")] || "",
      satellite: cols[idx("satellite")] || "",
      frp: parseFloat(cols[idx("frp")]) || 0,
      daynight: cols[idx("daynight")] || "",
      version: cols[idx("version")] || "",
      scan: parseFloat(cols[idx("scan")]) || 0,
      track: parseFloat(cols[idx("track")]) || 0,
      source: sourceLabel,
    }
  }).filter((h) => !isNaN(h.latitude) && !isNaN(h.longitude))
}
