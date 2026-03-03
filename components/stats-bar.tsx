"use client"

import { useEffect, useState } from "react"

interface StatsBarProps {
  hotspotCount: number
  seismicCount: number
  launchSuspects: number
  highIntensity: number
  lastUpdate: Date | null
  loading: boolean
  sourcesUsed: string[]
  gdeltCount?: number
  gdacsCount?: number
  error?: string | null
}

function LiveClock() {
  const [time, setTime] = useState("")
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="text-[10px] font-mono tabular-nums text-cyan-400/60">{time}</span>
}

function StatChip({
  color,
  glowColor,
  label,
  value,
  pulse,
}: {
  color: string
  glowColor?: string
  label: string
  value: string | number
  pulse?: boolean
}) {
  return (
    <div className="animate-fade-in-up flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300">
      <span className="relative flex items-center justify-center">
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${color}`}
          style={glowColor ? { boxShadow: `0 0 8px ${glowColor}` } : undefined}
        />
        {pulse && (
          <span className={`absolute inline-block w-1.5 h-1.5 rounded-full ${color} animate-ring-expand`} />
        )}
      </span>
      <span className="text-[11px] font-semibold font-mono tabular-nums text-foreground/90">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">{label}</span>
    </div>
  )
}

export default function StatsBar({
  hotspotCount,
  seismicCount,
  launchSuspects,
  highIntensity,
  lastUpdate,
  loading,
  sourcesUsed,
  gdeltCount = 0,
  gdacsCount = 0,
  error,
}: StatsBarProps) {
  return (
    <div className="relative flex items-center gap-2 px-4 py-2 bg-background/90 backdrop-blur-2xl border-b border-cyan-500/[0.08]">
      {/* Bottom glow line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

      {/* Brand */}
      <div className="flex items-center gap-2.5 mr-2">
        <span className="relative flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-cyan-400" style={{ boxShadow: "0 0 10px oklch(0.7 0.15 195 / 60%)" }} />
          <span className="absolute w-2 h-2 rounded-full bg-cyan-400 animate-ring-expand" />
        </span>
        <h1 className="text-[12px] font-bold tracking-[0.2em] uppercase text-foreground/80 font-mono">
          WorldView
        </h1>
      </div>

      <div className="w-px h-5 bg-cyan-500/[0.15]" />

      {/* Alert chips */}
      <div className="flex items-center gap-1.5 stagger-children">
        {launchSuspects > 0 && (
          <div className="animate-fade-in-up flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-500/10 border border-red-500/25 hover:border-red-500/40 transition-all duration-300" style={{ boxShadow: "0 0 20px oklch(0.6 0.25 25 / 15%)" }}>
            <span className="relative flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" style={{ boxShadow: "0 0 8px #ef4444" }} />
              <span className="absolute w-1.5 h-1.5 rounded-full bg-red-500 animate-ring-expand" />
            </span>
            <span className="text-[11px] font-bold font-mono tabular-nums text-red-400">{launchSuspects}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400/70">Suspect</span>
          </div>
        )}

        {highIntensity > 0 && (
          <StatChip color="bg-orange-400" glowColor="#ff8c0080" label="High" value={highIntensity} />
        )}

        <StatChip color="bg-yellow-400" glowColor="#ffcc0040" label="Total" value={hotspotCount} />

        {seismicCount > 0 && (
          <StatChip color="bg-purple-400" glowColor="#a855f780" label="Seismic" value={seismicCount} />
        )}

        {gdeltCount > 0 && (
          <StatChip color="bg-cyan-400" glowColor="#22d3ee60" label="OSINT" value={gdeltCount} />
        )}

        {gdacsCount > 0 && (
          <StatChip color="bg-amber-400" glowColor="#f59e0b60" label="Disasters" value={gdacsCount} />
        )}
      </div>

      {/* Right side info */}
      <div className="ml-auto flex items-center gap-3">
        {sourcesUsed.length > 0 && (
          <span className="text-[9px] font-mono uppercase tracking-wider text-cyan-400/40">{sourcesUsed.length} SAT</span>
        )}

        {loading && (
          <span className="relative flex items-center justify-center w-3 h-3">
            <span className="absolute w-3 h-3 rounded-full border border-cyan-400/40 border-t-cyan-400 animate-spin" />
          </span>
        )}

        {error && (
          <span className="text-[9px] font-mono text-red-400/70">{error}</span>
        )}

        <LiveClock />
      </div>
    </div>
  )
}
