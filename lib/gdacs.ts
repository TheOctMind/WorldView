export interface GdacsAlert {
  id: string
  title: string
  description: string
  latitude: number
  longitude: number
  alertLevel: "Red" | "Orange" | "Green"
  eventType: string      // "EQ", "TC", "FL", "VO", "DR", "WF"
  eventTypeName: string  // "Earthquake", "Tropical Cyclone", etc.
  severity: number       // magnitude for EQ, category for TC, etc.
  fromDate: string
  toDate: string
  url: string
  country: string
  timestamp: number
  sourceType: "gdacs"
}

const EVENT_TYPE_NAMES: Record<string, string> = {
  EQ: "Earthquake",
  TC: "Tropical Cyclone",
  FL: "Flood",
  VO: "Volcano",
  DR: "Drought",
  WF: "Wildfire",
}

/**
 * Parse GDACS GeoJSON/RSS response
 * GDACS API returns a JSON object with features array
 */
export function parseGdacsResponse(data: any): GdacsAlert[] {
  // GDACS API returns { features: [...] }
  if (!data?.features) return []

  return data.features
    .filter((f: any) => f.geometry?.coordinates || (f.properties?.lat && f.properties?.lng))
    .map((f: any) => {
      const props = f.properties || {}
      const coords = f.geometry?.coordinates || [props.lng || 0, props.lat || 0]
      const [lng, lat] = coords

      const eventType = props.eventtype || props.type || ""
      const alertLevel = props.alertlevel || props.alertLevel || "Green"

      return {
        id: props.eventid ? `gdacs-${props.eventid}` : `gdacs-${lat.toFixed(2)}-${lng.toFixed(2)}`,
        title: props.name || props.title || props.eventname || `${EVENT_TYPE_NAMES[eventType] || eventType} Alert`,
        description: props.description || props.htmldescription || "",
        latitude: lat,
        longitude: lng,
        alertLevel: alertLevel as GdacsAlert["alertLevel"],
        eventType,
        eventTypeName: EVENT_TYPE_NAMES[eventType] || eventType,
        severity: props.severity?.value || props.severitydata?.severity || props.mag || 0,
        fromDate: props.fromdate || props.fromDate || "",
        toDate: props.todate || props.toDate || "",
        url: props.url || props.link || "",
        country: props.country || props.countryname || "",
        timestamp: props.datemodified ? new Date(props.datemodified).getTime() : Date.now(),
        sourceType: "gdacs" as const,
      }
    })
    .filter((a: GdacsAlert) => !isNaN(a.latitude) && !isNaN(a.longitude))
}
