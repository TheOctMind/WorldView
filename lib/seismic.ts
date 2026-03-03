export interface SeismicEvent {
  id: string
  magnitude: number
  place: string
  time: number
  latitude: number
  longitude: number
  depth: number
  type: string // "earthquake", "explosion", "quarry blast", etc.
  tsunami: boolean
  url: string
}

export function parseUSGSGeoJSON(data: any): SeismicEvent[] {
  if (!data?.features) return []

  return data.features
    .map((f: any) => ({
      id: f.id,
      magnitude: f.properties.mag,
      place: f.properties.place || "",
      time: f.properties.time,
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
      depth: f.geometry.coordinates[2],
      type: f.properties.type || "earthquake",
      tsunami: !!f.properties.tsunami,
      url: f.properties.url || "",
    }))
    .filter((e: SeismicEvent) => !isNaN(e.latitude) && !isNaN(e.longitude))
}
