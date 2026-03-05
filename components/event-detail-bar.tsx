"use client"

import { useEffect, useState } from "react"
import type { FirmsHotspot } from "@/lib/firms"
import type { SeismicEvent } from "@/lib/seismic"
import type { GdeltEvent } from "@/lib/gdelt"
import type { GdacsAlert } from "@/lib/gdacs"
import { getImageryDate, getImageryFreshness } from "@/lib/imagery-date"

type SelectedEvent =
  | { type: "hotspot"; data: FirmsHotspot; timestamp: number }
  | { type: "seismic"; data: SeismicEvent & { suspicious: boolean }; timestamp: number }
  | { type: "gdelt"; data: GdeltEvent; timestamp: number }
  | { type: "gdacs"; data: GdacsAlert; timestamp: number }

interface EventDetailBarProps {
  selectedHotspot: FirmsHotspot | null
  selectedSeismic: (SeismicEvent & { suspicious: boolean }) | null
  selectedGdelt: GdeltEvent | null
  selectedGdacs: GdacsAlert | null
}

function hotspotTimestamp(h: FirmsHotspot): number {
  if (!h.acq_date) return 0
  const time = h.acq_time?.padStart(4, "0") || "0000"
  const dateStr = `${h.acq_date}T${time.slice(0, 2)}:${time.slice(2, 4)}:00Z`
  const ts = Date.parse(dateStr)
  return isNaN(ts) ? 0 : ts
}

function getSelected(props: EventDetailBarProps): SelectedEvent | null {
  if (props.selectedHotspot) {
    return { type: "hotspot", data: props.selectedHotspot, timestamp: hotspotTimestamp(props.selectedHotspot) }
  }
  if (props.selectedSeismic) {
    return { type: "seismic", data: props.selectedSeismic, timestamp: props.selectedSeismic.time || 0 }
  }
  if (props.selectedGdelt) {
    return { type: "gdelt", data: props.selectedGdelt, timestamp: props.selectedGdelt.timestamp || 0 }
  }
  if (props.selectedGdacs) {
    return { type: "gdacs", data: props.selectedGdacs, timestamp: props.selectedGdacs.timestamp || 0 }
  }
  return null
}

function formatEventTime(ts: number): string {
  if (!ts) return "Unknown"
  const d = new Date(ts)
  const date = d.toISOString().slice(0, 10)
  const time = d.toISOString().slice(11, 16)
  return `${date} ${time} UTC`
}

function timeAgo(ts: number): string {
  if (!ts) return ""
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function getEventLabel(event: SelectedEvent): string {
  if (event.type === "hotspot") {
    const h = event.data
    if (h.classification === "launch_suspect") return "LAUNCH SUSPECT"
    if (h.classification === "high_intensity") return "HIGH INTENSITY"
    return "FIRE DETECTION"
  }
  if (event.type === "seismic") {
    return event.data.suspicious ? "SHALLOW SEISMIC" : "SEISMIC EVENT"
  }
  if (event.type === "gdelt") return "OSINT EVENT"
  return (event.data as GdacsAlert).eventTypeName?.toUpperCase() || "DISASTER ALERT"
}

function getEventColor(event: SelectedEvent): string {
  if (event.type === "hotspot") {
    const h = event.data
    if (h.classification === "launch_suspect") return "#ef4444"
    if (h.classification === "high_intensity") return "#ff8c00"
    return "#eab308"
  }
  if (event.type === "seismic") return "#a855f7"
  if (event.type === "gdelt") return "#22d3ee"
  return "#f59e0b"
}

export default function EventDetailBar(props: EventDetailBarProps) {
  const selected = getSelected(props)
  const [imageryDate, setImageryDate] = useState<string | null>(null)
  const [loadingImagery, setLoadingImagery] = useState(false)

  useEffect(() => {
    if (!selected) {
      setImageryDate(null)
      return
    }

    const lat = selected.data.latitude
    const lng = selected.data.longitude

    setLoadingImagery(true)
    setImageryDate(null)

    getImageryDate(lat, lng, selected.timestamp)
      .then((date) => setImageryDate(date))
      .finally(() => setLoadingImagery(false))
  }, [
    // Re-fetch when selected event changes
    selected?.type,
    selected?.data.latitude,
    selected?.data.longitude,
    selected?.timestamp,
  ])

  if (!selected) return null

  const eventColor = getEventColor(selected)
  const eventLabel = getEventLabel(selected)
  const eventTime = formatEventTime(selected.timestamp)
  const eventAgo = timeAgo(selected.timestamp)

  const freshness = getImageryFreshness(selected.timestamp, imageryDate)

  const freshnessColor =
    freshness.status === "fresh" ? "#22c55e" :
    freshness.status === "outdated" ? "#eab308" :
    "#6b7280"

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20 animate-fade-in-up"
      style={{ animation: "fade-in-up 0.3s ease-out" }}
    >
      <div className="mx-2 mb-2 sm:mx-4 sm:mb-4 rounded-lg bg-background/85 backdrop-blur-2xl border border-white/[0.08] shadow-2xl shadow-black/60">
        <div className="px-3 py-2.5 sm:px-5 sm:py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">

          {/* Event type badge */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: eventColor, boxShadow: `0 0 8px ${eventColor}60` }}
            />
            <span
              className="text-[11px] font-mono font-bold tracking-wider"
              style={{ color: eventColor }}
            >
              {eventLabel}
            </span>
          </div>

          {/* Event detection time */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[9px] font-mono text-foreground/30 uppercase tracking-wider">Detected</span>
            <span className="text-[11px] font-mono font-medium text-foreground/70 tabular-nums">
              {eventTime}
            </span>
            {eventAgo && (
              <span className="text-[10px] font-mono text-foreground/35">({eventAgo})</span>
            )}
          </div>

          {/* Separator */}
          <div className="hidden sm:block w-px h-5 bg-white/[0.08]" />

          {/* Imagery date */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[9px] font-mono text-foreground/30 uppercase tracking-wider">Sentinel-2</span>
            {loadingImagery ? (
              <span className="text-[10px] font-mono text-foreground/30 animate-pulse">checking...</span>
            ) : imageryDate ? (
              <span className="text-[11px] font-mono font-medium text-foreground/70 tabular-nums">
                {imageryDate}
              </span>
            ) : (
              <span className="text-[10px] font-mono text-foreground/30">N/A</span>
            )}
          </div>

          {/* Freshness status */}
          <div className="flex items-center gap-1.5 sm:ml-auto flex-shrink-0">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: freshnessColor, boxShadow: `0 0 6px ${freshnessColor}50` }}
            />
            <span
              className="text-[9px] font-mono font-semibold tracking-wider"
              style={{ color: freshnessColor }}
            >
              {loadingImagery ? "CHECKING..." : freshness.label}
            </span>
            {freshness.daysAgo !== undefined && !loadingImagery && (
              <span className="text-[9px] font-mono text-foreground/25">
                ({freshness.daysAgo === 0 ? "today" : `${freshness.daysAgo}d ago`})
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
