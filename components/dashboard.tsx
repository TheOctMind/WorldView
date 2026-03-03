"use client"

import { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import StatsBar from "@/components/stats-bar"
import ControlPanel from "@/components/control-panel"
import { ThemeToggle } from "@/components/theme-toggle"
import { loadCountryData } from "@/lib/country-lookup"
import type { FirmsHotspot } from "@/lib/firms"
import type { SeismicEvent } from "@/lib/seismic"
import type { GdeltEvent } from "@/lib/gdelt"
import type { GdacsAlert } from "@/lib/gdacs"

const WorldMap = dynamic(() => import("@/components/map"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-background">
      <div className="flex flex-col items-center gap-3">
        <span className="relative flex items-center justify-center w-8 h-8">
          <span className="absolute w-8 h-8 rounded-full border border-cyan-500/30 border-t-cyan-400 animate-spin" />
          <span className="w-2 h-2 rounded-full bg-cyan-400" style={{ boxShadow: "0 0 8px oklch(0.7 0.15 195 / 60%)" }} />
        </span>
        <p className="text-[11px] font-mono tracking-wider uppercase text-cyan-400/50">Initializing satellite feed</p>
      </div>
    </div>
  ),
})

const POLL_INTERVAL_MS = 60_000

export default function Dashboard() {
  const [hotspots, setHotspots] = useState<FirmsHotspot[]>([])
  const [seismicEvents, setSeismicEvents] = useState<(SeismicEvent & { suspicious: boolean })[]>([])
  const [gdeltEvents, setGdeltEvents] = useState<GdeltEvent[]>([])
  const [gdacsAlerts, setGdacsAlerts] = useState<GdacsAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [launchSuspects, setLaunchSuspects] = useState(0)
  const [highIntensity, setHighIntensity] = useState(0)
  const [sourcesUsed, setSourcesUsed] = useState<string[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedHotspot, setSelectedHotspot] = useState<FirmsHotspot | null>(null)
  const [selectedSeismic, setSelectedSeismic] = useState<(SeismicEvent & { suspicious: boolean }) | null>(null)
  const [cameraCenter, setCameraCenter] = useState<{ lat: number; lng: number }>({ lat: 30, lng: 50 })

  useEffect(() => {
    loadCountryData()
  }, [])

  // Fetch each source independently so fast ones render immediately
  // instead of waiting for the slowest (FIRMS ~10s on cold start)
  const fetchData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    let failedSources = 0

    // Fire all fetches in parallel but process each as it resolves
    const firmsP = fetch("/api/firms?source=all&days=1&region=world")
      .then(async (r) => {
        if (!r.ok) { failedSources++; return }
        const data = await r.json()
        setHotspots(data.hotspots || [])
        setLaunchSuspects(data.launchSuspects || 0)
        setHighIntensity(data.highIntensity || 0)
        setSourcesUsed(data.sourcesUsed || [])
      })
      .catch(() => { failedSources++ })

    const seismicP = fetch("/api/seismic?region=world&feed=day")
      .then(async (r) => {
        if (!r.ok) { failedSources++; return }
        const data = await r.json()
        setSeismicEvents(data.events || [])
      })
      .catch(() => { failedSources++ })

    const gdeltP = fetch("/api/gdelt")
      .then(async (r) => {
        if (!r.ok) { failedSources++; return }
        const data = await r.json()
        setGdeltEvents(data.events || [])
      })
      .catch(() => { failedSources++ })

    const gdacsP = fetch("/api/gdacs")
      .then(async (r) => {
        if (!r.ok) { failedSources++; return }
        const data = await r.json()
        setGdacsAlerts(data.alerts || [])
      })
      .catch(() => { failedSources++ })

    await Promise.allSettled([firmsP, seismicP, gdeltP, gdacsP])

    if (failedSources > 0 && failedSources < 4) {
      setFetchError(`${failedSources} data source(s) unavailable`)
    } else if (failedSources === 4) {
      setFetchError("All data sources unreachable")
    }

    setLastUpdate(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const interval = setInterval(fetchData, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleSelectHotspot = useCallback((h: FirmsHotspot) => {
    setSelectedHotspot(h)
    setSelectedSeismic(null)
    setFocusTarget({ lat: h.latitude, lng: h.longitude })
  }, [])

  const handleSelectSeismic = useCallback((e: SeismicEvent & { suspicious: boolean }) => {
    setSelectedSeismic(e)
    setSelectedHotspot(null)
    setFocusTarget({ lat: e.latitude, lng: e.longitude })
  }, [])

  const handleSelectGdelt = useCallback((e: GdeltEvent) => {
    setSelectedHotspot(null)
    setSelectedSeismic(null)
    setFocusTarget({ lat: e.latitude, lng: e.longitude })
  }, [])

  const handleSelectGdacs = useCallback((a: GdacsAlert) => {
    setSelectedHotspot(null)
    setSelectedSeismic(null)
    setFocusTarget({ lat: a.latitude, lng: a.longitude })
  }, [])

  const handleCameraMove = useCallback((center: { lat: number; lng: number }) => {
    setCameraCenter(center)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-background">
      <StatsBar
        hotspotCount={hotspots.length}
        seismicCount={seismicEvents.length}
        launchSuspects={launchSuspects}
        highIntensity={highIntensity}
        lastUpdate={lastUpdate}
        loading={loading}
        sourcesUsed={sourcesUsed}
        gdeltCount={gdeltEvents.length}
        gdacsCount={gdacsAlerts.length}
        error={fetchError}
      />

      <div className="flex-1 min-h-0 relative">
        <WorldMap
          hotspots={hotspots}
          seismicEvents={seismicEvents}
          gdeltEvents={gdeltEvents}
          gdacsAlerts={gdacsAlerts}
          focusTarget={focusTarget}
          externalSelectedHotspot={selectedHotspot}
          externalSelectedSeismic={selectedSeismic}
          onCameraMove={handleCameraMove}
        />

        <div className="absolute top-4 left-4 z-10 max-h-[calc(100vh-80px)] overflow-y-auto">
          <ControlPanel
            launchSuspects={launchSuspects}
            highIntensity={highIntensity}
            seismicEvents={seismicEvents}
            hotspots={hotspots}
            gdeltEvents={gdeltEvents}
            gdacsAlerts={gdacsAlerts}
            onSelectHotspot={handleSelectHotspot}
            onSelectSeismic={handleSelectSeismic}
            onSelectGdelt={handleSelectGdelt}
            onSelectGdacs={handleSelectGdacs}
            cameraCenter={cameraCenter}
          />
        </div>

        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
