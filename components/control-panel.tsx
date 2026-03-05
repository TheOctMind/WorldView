"use client"

import { useMemo, useState, useRef, useCallback } from "react"
import type { FirmsHotspot } from "@/lib/firms"
import type { SeismicEvent } from "@/lib/seismic"
import type { GdeltEvent } from "@/lib/gdelt"
import type { GdacsAlert } from "@/lib/gdacs"
import { getCountryName } from "@/lib/country-lookup"

interface ControlPanelProps {
  launchSuspects: number
  highIntensity: number
  seismicEvents: (SeismicEvent & { suspicious: boolean })[]
  hotspots: FirmsHotspot[]
  gdeltEvents: GdeltEvent[]
  gdacsAlerts: GdacsAlert[]
  onSelectHotspot: (h: FirmsHotspot) => void
  onSelectSeismic: (e: SeismicEvent & { suspicious: boolean }) => void
  onSelectGdelt: (e: GdeltEvent) => void
  onSelectGdacs: (a: GdacsAlert) => void
  cameraCenter?: { lat: number; lng: number }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type EventLogItem =
  | { type: "hotspot"; timestamp: number; data: FirmsHotspot }
  | { type: "seismic"; timestamp: number; data: SeismicEvent & { suspicious: boolean } }
  | { type: "gdelt"; timestamp: number; data: GdeltEvent }
  | { type: "gdacs"; timestamp: number; data: GdacsAlert }

function getItemLatLng(item: EventLogItem): { lat: number; lng: number } {
  return { lat: item.data.latitude, lng: item.data.longitude }
}

function getItemCountry(item: EventLogItem): string {
  if (item.type === "gdacs") return item.data.country || ""
  const pos = getItemLatLng(item)
  return getCountryName(pos.lat, pos.lng) || ""
}

function hotspotTimestamp(h: FirmsHotspot): number {
  if (!h.acq_date) return 0
  const time = h.acq_time?.padStart(4, "0") || "0000"
  const dateStr = `${h.acq_date}T${time.slice(0, 2)}:${time.slice(2, 4)}:00Z`
  const ts = Date.parse(dateStr)
  return isNaN(ts) ? 0 : ts
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

function SectionHeader({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono font-semibold tracking-[0.15em] uppercase text-cyan-400/70">
        {children}
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/20 to-transparent" />
      {count !== undefined && (
        <span className="text-[10px] font-mono tabular-nums text-cyan-400/40">{count.toLocaleString()}</span>
      )}
    </div>
  )
}

function AlertBanner({
  count,
  label,
  sublabel,
  color,
  glowColor,
  pulse,
}: {
  count: number
  label: string
  sublabel?: string
  color: string
  glowColor: string
  pulse?: boolean
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 transition-all duration-300 ${pulse ? "animate-glow-pulse" : ""}`}
      style={{
        borderColor: `${glowColor}30`,
        backgroundColor: `${glowColor}08`,
        boxShadow: `inset 0 0 20px ${glowColor}05, 0 0 12px ${glowColor}10`,
      }}
    >
      <div className="flex items-baseline gap-1.5">
        <span className={`text-sm font-bold font-mono tabular-nums ${color}`}>{count}</span>
        <span className={`text-[10px] font-semibold font-mono tracking-wider uppercase ${color}`}>{label}</span>
      </div>
      {sublabel && (
        <p className={`text-[9px] font-mono mt-0.5 ${color} opacity-50`}>{sublabel}</p>
      )}
    </div>
  )
}

export default function ControlPanel({
  launchSuspects,
  highIntensity,
  seismicEvents,
  hotspots,
  gdeltEvents,
  gdacsAlerts,
  onSelectHotspot,
  onSelectSeismic,
  onSelectGdelt,
  onSelectGdacs,
  cameraCenter,
}: ControlPanelProps) {
  const [countryFilter, setCountryFilter] = useState("")
  const [maxDistanceKm, setMaxDistanceKm] = useState<number | null>(null)

  const suspiciousQuakes = (seismicEvents || []).filter((e) => e.suspicious)
  const redAlerts = gdacsAlerts.filter(a => a.alertLevel === "Red").length

  const sortedLog = useMemo(() => {
    const now = Date.now()

    const hotspotsWithTs = (hotspots || []).map((h) => ({
      ts: hotspotTimestamp(h),
      data: h,
    }))
    hotspotsWithTs.sort((a, b) => b.ts - a.ts)

    const hotspotItems: EventLogItem[] = hotspotsWithTs.map((h) => ({
      type: "hotspot" as const,
      timestamp: h.ts,
      data: h.data,
    }))

    const seismicItems: EventLogItem[] = (seismicEvents || []).map((e) => ({
      type: "seismic" as const,
      timestamp: e.time || 0,
      data: e,
    }))

    const gdeltItems: EventLogItem[] = (gdeltEvents || []).map((e) => ({
      type: "gdelt" as const,
      timestamp: e.timestamp || now,
      data: e,
    }))

    const gdacsItems: EventLogItem[] = (gdacsAlerts || []).map((a) => ({
      type: "gdacs" as const,
      timestamp: a.timestamp || now,
      data: a,
    }))

    const allItems = [...hotspotItems, ...seismicItems, ...gdeltItems, ...gdacsItems]
    allItems.sort((a, b) => b.timestamp - a.timestamp)
    return allItems
  }, [hotspots, seismicEvents, gdeltEvents, gdacsAlerts])

  const filteredLog = useMemo(() => {
    const hasCountry = countryFilter.trim().length > 0
    const hasDistance = maxDistanceKm !== null && maxDistanceKm > 0 && cameraCenter
    if (!hasCountry && !hasDistance) return sortedLog

    const countryLower = countryFilter.trim().toLowerCase()

    return sortedLog.filter((item) => {
      const pos = getItemLatLng(item)

      if (hasCountry && hasDistance && cameraCenter) {
        const country = getItemCountry(item).toLowerCase()
        const dist = haversineKm(cameraCenter.lat, cameraCenter.lng, pos.lat, pos.lng)
        return country.includes(countryLower) && dist <= maxDistanceKm!
      }

      if (hasCountry) {
        return getItemCountry(item).toLowerCase().includes(countryLower)
      }

      if (hasDistance && cameraCenter) {
        const dist = haversineKm(cameraCenter.lat, cameraCenter.lng, pos.lat, pos.lng)
        return dist <= maxDistanceKm!
      }

      return true
    })
  }, [sortedLog, countryFilter, maxDistanceKm, cameraCenter])

  return (
    <div className="w-72 rounded-lg hud-corners bg-background/80 backdrop-blur-2xl border border-cyan-500/[0.10] shadow-2xl shadow-black/60 animate-fade-in-up">
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2">
        <SectionHeader>Launch Monitor</SectionHeader>
      </div>

      {/* Alert banners */}
      <div className="px-3 space-y-1.5">
        {launchSuspects > 0 && (
          <AlertBanner
            count={launchSuspects}
            label="Suspect Events"
            sublabel="Extreme thermal signature detected"
            color="text-red-400"
            glowColor="#ef4444"
            pulse
          />
        )}
        {highIntensity > 0 && (
          <AlertBanner
            count={highIntensity}
            label="High Intensity"
            color="text-orange-400"
            glowColor="#ff8c00"
          />
        )}
        {suspiciousQuakes.length > 0 && (
          <AlertBanner
            count={suspiciousQuakes.length}
            label="Shallow Seismic"
            color="text-purple-400"
            glowColor="#a855f7"
          />
        )}
        {redAlerts > 0 && (
          <AlertBanner
            count={redAlerts}
            label={`Red Alert${redAlerts > 1 ? "s" : ""}`}
            color="text-red-400"
            glowColor="#ef4444"
          />
        )}
      </div>

      {/* Divider */}
      <div className="mx-3 my-3 h-px bg-gradient-to-r from-cyan-500/15 via-cyan-500/8 to-transparent" />

      {/* Legend */}
      <div className="px-4 space-y-2">
        <SectionHeader>Legend</SectionHeader>
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-2">
          <LegendItem color="bg-red-500" glow="#ef4444" label="Suspect" />
          <LegendItem color="bg-orange-500" glow="#ff8c00" label="High Intensity" />
          <LegendItem color="bg-yellow-400" glow="#eab308" label="Fire" />
          <LegendItem color="bg-purple-500" glow="#a855f7" label="Seismic" />
          <LegendItem color="bg-cyan-400" glow="#22d3ee" label="OSINT" />
          <LegendItem color="bg-amber-500" glow="#f59e0b" label="Disaster" square />
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 my-3 h-px bg-gradient-to-r from-cyan-500/15 via-cyan-500/8 to-transparent" />

      {/* Filters */}
      <div className="px-4 space-y-2">
        <SectionHeader>Filters</SectionHeader>
        <div className="space-y-1.5">
          <input
            type="text"
            placeholder="Country..."
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="w-full bg-white/[0.03] border border-cyan-500/[0.10] rounded-md px-2.5 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-cyan-500/30 focus:shadow-[0_0_12px_oklch(0.7_0.15_195/15%)] transition-all duration-300"
          />
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="Max km..."
              value={maxDistanceKm ?? ""}
              onChange={(e) => {
                const v = e.target.value
                setMaxDistanceKm(v === "" ? null : Math.max(0, parseInt(v) || 0))
              }}
              className="w-full bg-white/[0.03] border border-cyan-500/[0.10] rounded-md px-2.5 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-cyan-500/30 focus:shadow-[0_0_12px_oklch(0.7_0.15_195/15%)] transition-all duration-300"
              min={0}
            />
            <span className="text-[9px] font-mono text-foreground/30 flex-shrink-0">km radius</span>
          </div>
          {(countryFilter || maxDistanceKm) && (
            <button
              className="text-[10px] font-mono text-cyan-400/40 hover:text-cyan-400/70 transition-colors duration-200"
              onClick={() => { setCountryFilter(""); setMaxDistanceKm(null) }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 my-3 h-px bg-gradient-to-r from-cyan-500/15 via-cyan-500/8 to-transparent" />

      {/* Event Log */}
      <div className="px-3 pb-3">
        <VirtualEventLog
          items={filteredLog}
          onSelectHotspot={onSelectHotspot}
          onSelectSeismic={onSelectSeismic}
          onSelectGdelt={onSelectGdelt}
          onSelectGdacs={onSelectGdacs}
          cameraCenter={cameraCenter}
        />
      </div>
    </div>
  )
}

function LegendItem({ color, label, glow, square }: { color: string; label: string; glow?: string; square?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block w-2 h-2 flex-shrink-0 ${color} ${square ? "rounded-sm" : "rounded-full"}`}
        style={glow ? { boxShadow: `0 0 6px ${glow}50` } : undefined}
      />
      <span className="text-[10px] font-mono text-foreground/40">{label}</span>
    </div>
  )
}

const ITEM_HEIGHT = 58
const CONTAINER_HEIGHT = 380
const BUFFER = 10

function VirtualEventLog({
  items,
  onSelectHotspot,
  onSelectSeismic,
  onSelectGdelt,
  onSelectGdacs,
  cameraCenter,
}: {
  items: EventLogItem[]
  onSelectHotspot: (h: FirmsHotspot) => void
  onSelectSeismic: (e: SeismicEvent & { suspicious: boolean }) => void
  onSelectGdelt: (e: GdeltEvent) => void
  onSelectGdacs: (a: GdacsAlert) => void
  cameraCenter?: { lat: number; lng: number }
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop)
    }
  }, [])

  const totalHeight = items.length * ITEM_HEIGHT
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER)
  const endIndex = Math.min(items.length, Math.ceil((scrollTop + CONTAINER_HEIGHT) / ITEM_HEIGHT) + BUFFER)
  const visibleItems = items.slice(startIndex, endIndex)

  return (
    <div className="space-y-1.5">
      <div className="px-1">
        <SectionHeader count={items.length}>Event Log</SectionHeader>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-y-auto"
        style={{ maxHeight: CONTAINER_HEIGHT }}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          <div style={{ position: "absolute", top: startIndex * ITEM_HEIGHT, left: 0, right: 0 }}>
            {visibleItems.map((item, vi) => {
              const i = startIndex + vi
              return (
                <EventLogRow
                  key={`${item.type}-${i}`}
                  item={item}
                  onSelectHotspot={onSelectHotspot}
                  onSelectSeismic={onSelectSeismic}
                  onSelectGdelt={onSelectGdelt}
                  onSelectGdacs={onSelectGdacs}
                  cameraCenter={cameraCenter}
                />
              )
            })}
          </div>
        </div>
      </div>
      {items.length === 0 && (
        <p className="text-[11px] font-mono text-muted-foreground/30 text-center py-6">
          No events detected
        </p>
      )}
    </div>
  )
}

function getAccentColor(item: EventLogItem): string {
  if (item.type === "hotspot") {
    const h = item.data
    if (h.classification === "launch_suspect") return "bg-red-500"
    if (h.classification === "high_intensity") return "bg-orange-500"
    return "bg-yellow-400"
  }
  if (item.type === "seismic") return "bg-purple-500"
  if (item.type === "gdelt") return "bg-cyan-400"
  return "bg-amber-500"
}

function getGlowHex(item: EventLogItem): string {
  if (item.type === "hotspot") {
    const h = item.data
    if (h.classification === "launch_suspect") return "#ef4444"
    if (h.classification === "high_intensity") return "#ff8c00"
    return "#eab308"
  }
  if (item.type === "seismic") return "#a855f7"
  if (item.type === "gdelt") return "#22d3ee"
  return "#f59e0b"
}

function formatDistance(km: number): string {
  if (km < 1) return "<1 km"
  if (km < 100) return `${km.toFixed(0)} km`
  return `${(km / 1000).toFixed(1)}k km`
}

function EventLogRow({
  item,
  onSelectHotspot,
  onSelectSeismic,
  onSelectGdelt,
  onSelectGdacs,
  cameraCenter,
}: {
  item: EventLogItem
  onSelectHotspot: (h: FirmsHotspot) => void
  onSelectSeismic: (e: SeismicEvent & { suspicious: boolean }) => void
  onSelectGdelt: (e: GdeltEvent) => void
  onSelectGdacs: (a: GdacsAlert) => void
  cameraCenter?: { lat: number; lng: number }
}) {
  const accent = getAccentColor(item)
  const glowHex = getGlowHex(item)

  const handleClick = () => {
    if (item.type === "hotspot") onSelectHotspot(item.data)
    else if (item.type === "seismic") onSelectSeismic(item.data)
    else if (item.type === "gdelt") onSelectGdelt(item.data)
    else onSelectGdacs(item.data)
  }

  let title = ""
  let badge = ""
  let country = ""
  let time = ""
  let distLabel = ""
  const pos = getItemLatLng(item)

  // Calculate distance from camera center
  if (cameraCenter) {
    const dist = haversineKm(cameraCenter.lat, cameraCenter.lng, pos.lat, pos.lng)
    distLabel = formatDistance(dist)
  }

  if (item.type === "hotspot") {
    const h = item.data
    country = getCountryName(h.latitude, h.longitude)
    title = h.classification === "launch_suspect" ? "SUSPECT" : h.classification === "high_intensity" ? "HIGH" : "FIRE"
    badge = `${h.frp.toFixed(0)} MW`
    time = timeAgo(item.timestamp)
  } else if (item.type === "seismic") {
    const e = item.data
    country = getCountryName(e.latitude, e.longitude)
    title = `M${e.magnitude?.toFixed(1)} ${e.suspicious ? "SHALLOW" : "Quake"}`
    badge = `${e.depth?.toFixed(0)}km deep`
    time = timeAgo(item.timestamp)
  } else if (item.type === "gdelt") {
    const e = item.data
    country = getCountryName(e.latitude, e.longitude)
    title = "OSINT"
    badge = `${e.count} articles`
    time = timeAgo(item.timestamp)
  } else {
    const a = item.data
    title = a.eventTypeName || a.eventType
    badge = a.alertLevel
    country = a.country || ""
    time = timeAgo(item.timestamp)
  }

  return (
    <button
      className="w-full text-left rounded-md hover:bg-cyan-500/[0.06] transition-all duration-200 group flex items-stretch gap-0"
      style={{ height: ITEM_HEIGHT }}
      onClick={handleClick}
    >
      {/* Left accent bar with glow */}
      <div
        className={`w-0.5 rounded-full ${accent} opacity-50 group-hover:opacity-100 transition-all duration-200 my-1.5 ml-0.5 flex-shrink-0`}
        style={{ boxShadow: `0 0 4px ${glowHex}30` }}
      />

      <div className="flex-1 min-w-0 px-2 py-1 flex flex-col justify-center">
        {/* Row 1: title + badge */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono font-semibold truncate" style={{ color: glowHex }}>{title}</span>
          <span className="text-[10px] font-mono tabular-nums text-foreground/50 ml-auto flex-shrink-0">{badge}</span>
        </div>
        {/* Row 2: country */}
        <p className="text-[10px] font-mono text-foreground/60 mt-0.5 truncate">
          {country || `${pos.lat.toFixed(2)}, ${pos.lng.toFixed(2)}`}
        </p>
        {/* Row 3: time + distance */}
        <div className="flex items-center gap-1.5 mt-0.5">
          {time && <span className="text-[9px] font-mono text-foreground/35">{time}</span>}
          {distLabel && <span className="text-[9px] font-mono text-cyan-400/40">{distLabel} away</span>}
        </div>
      </div>
    </button>
  )
}
