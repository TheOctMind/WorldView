export interface GdeltEvent {
  id: string
  name: string
  latitude: number
  longitude: number
  count: number       // number of articles mentioning this location
  url?: string        // representative article URL
  imageUrl?: string   // thumbnail
  timestamp: number   // when we fetched it (GDELT doesn't provide per-point timestamps)
  sourceType: "gdelt"
}

/**
 * Parse GDELT GEO API GeoJSON response
 * The GEO API returns a FeatureCollection with Point features
 */
export function parseGdeltGeoJSON(data: any): GdeltEvent[] {
  if (!data?.features) return []

  return data.features
    .filter((f: any) => f.geometry?.type === "Point" && f.geometry?.coordinates)
    .map((f: any, i: number) => {
      const [lng, lat] = f.geometry.coordinates
      const props = f.properties || {}
      return {
        id: `gdelt-${i}-${lat.toFixed(3)}-${lng.toFixed(3)}`,
        name: props.name || props.html?.replace(/<[^>]*>/g, "").slice(0, 80) || "Conflict event",
        latitude: lat,
        longitude: lng,
        count: props.count || 1,
        url: props.url || undefined,
        imageUrl: props.urlthumbnail || undefined,
        timestamp: Date.now(),
        sourceType: "gdelt" as const,
      }
    })
    .filter((e: GdeltEvent) => !isNaN(e.latitude) && !isNaN(e.longitude))
}
