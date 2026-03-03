import whichPolygon from "which-polygon"

let query: ReturnType<typeof whichPolygon> | null = null
let loadPromise: Promise<void> | null = null

export async function loadCountryData(): Promise<void> {
  if (query) return
  if (loadPromise) return loadPromise

  loadPromise = fetch("/data/countries.geojson")
    .then((r) => r.json())
    .then((geojson) => {
      query = whichPolygon(geojson)
    })
    .catch((err) => {
      console.error("Failed to load country data:", err)
    })

  return loadPromise
}

export function getCountryName(lat: number, lng: number): string {
  if (!query) return ""
  const result = query([lng, lat])
  return String(result?.NAME || result?.ADMIN || "")
}
