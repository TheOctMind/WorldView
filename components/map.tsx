"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import type { FirmsHotspot } from "@/lib/firms"
import type { SeismicEvent } from "@/lib/seismic"
import type { GdeltEvent } from "@/lib/gdelt"
import type { GdacsAlert } from "@/lib/gdacs"

interface WorldMapProps {
  hotspots: FirmsHotspot[]
  seismicEvents: (SeismicEvent & { suspicious: boolean })[]
  gdeltEvents: GdeltEvent[]
  gdacsAlerts: GdacsAlert[]
  focusTarget?: { lat: number; lng: number } | null
  externalSelectedHotspot?: FirmsHotspot | null
  externalSelectedSeismic?: (SeismicEvent & { suspicious: boolean }) | null
  onCameraMove?: (center: { lat: number; lng: number }) => void
}

function getClassColor(classification?: string): [number, number, number] {
  switch (classification) {
    case "launch_suspect": return [1.0, 0.0, 0.0]
    case "high_intensity": return [1.0, 0.55, 0.0]
    default: return [1.0, 0.8, 0.0]
  }
}

function getClassLabel(classification?: string): string {
  switch (classification) {
    case "launch_suspect": return "SUSPECT - Possible Launch/Explosion"
    case "high_intensity": return "High Intensity Anomaly"
    default: return "Fire / Thermal Anomaly"
  }
}

function getClassColorHex(classification?: string): string {
  switch (classification) {
    case "launch_suspect": return "#ff0000"
    case "high_intensity": return "#ff8c00"
    default: return "#ffcc00"
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type CesiumViewer = any
type CesiumModule = any
/* eslint-enable @typescript-eslint/no-explicit-any */

function Popup({
  position,
  children,
  onClose,
  viewerRef,
}: {
  position: { lat: number; lng: number }
  children: React.ReactNode
  onClose: () => void
  viewerRef: React.RefObject<CesiumViewer | null>
}) {
  const divRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !divRef.current) return

    const Cesium = (window as Record<string, CesiumModule>).Cesium
    if (!Cesium) return

    const cartesian = Cesium.Cartesian3.fromDegrees(position.lng, position.lat)

    function updatePosition() {
      if (!viewer || viewer.isDestroyed() || !divRef.current) return
      const windowPos = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, cartesian)
      if (windowPos) {
        divRef.current.style.left = `${windowPos.x}px`
        divRef.current.style.top = `${windowPos.y - 10}px`
        divRef.current.style.display = "block"
      } else {
        divRef.current.style.display = "none"
      }
    }

    viewer.scene.preRender.addEventListener(updatePosition)
    return () => {
      if (!viewer.isDestroyed()) {
        viewer.scene.preRender.removeEventListener(updatePosition)
      }
    }
  }, [position, viewerRef])

  return (
    <div
      ref={divRef}
      className="absolute z-50 -translate-x-1/2 -translate-y-full pointer-events-auto"
      style={{ display: "none" }}
    >
      <div className="bg-background/90 backdrop-blur-2xl border border-cyan-500/[0.15] rounded-lg shadow-2xl shadow-black/60 p-3.5 min-w-[240px] max-w-[320px]" style={{ boxShadow: "0 0 20px oklch(0.7 0.15 195 / 10%), 0 8px 32px rgba(0,0,0,0.5)" }}>
        <button
          onClick={onClose}
          className="absolute top-2 right-2.5 w-5 h-5 flex items-center justify-center rounded-full text-muted-foreground/40 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all duration-200 text-sm leading-none"
        >
          &times;
        </button>
        {children}
      </div>
      <div className="w-2.5 h-2.5 bg-background/90 border-r border-b border-cyan-500/[0.15] rotate-45 mx-auto -mt-1.5" />
    </div>
  )
}

interface PrimitiveCollections {
  firePoints: CesiumModule
  suspectGlow: CesiumModule
  suspectCore: CesiumModule
  seismicPoints: CesiumModule
  seismicLabels: CesiumModule
  gdeltPoints: CesiumModule
  gdeltLabels: CesiumModule
  gdacsPoints: CesiumModule
  gdacsLabels: CesiumModule
  highlightPoints: CesiumModule
  highlightLabels: CesiumModule
}

/* ─── Globe Loading Overlay ─── */
function GlobeLoadingOverlay({ progress }: { progress: number }) {
  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background transition-opacity duration-700"
      style={{ opacity: progress >= 100 ? 0 : 1, pointerEvents: progress >= 100 ? "none" : "auto" }}
    >
      {/* Orbit rings */}
      <div className="relative w-48 h-48 flex items-center justify-center">
        {/* Outer orbit */}
        <div
          className="absolute w-48 h-48 rounded-full border border-cyan-500/20"
          style={{ animation: "orbit 6s linear infinite" }}
        >
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-400"
            style={{ boxShadow: "0 0 8px oklch(0.7 0.15 195 / 80%)" }} />
        </div>
        {/* Middle orbit */}
        <div
          className="absolute w-32 h-32 rounded-full border border-cyan-500/15"
          style={{ animation: "orbit 4s linear infinite reverse" }}
        >
          <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-300/80"
            style={{ boxShadow: "0 0 6px oklch(0.7 0.15 195 / 60%)" }} />
        </div>
        {/* Inner orbit */}
        <div
          className="absolute w-20 h-20 rounded-full border border-cyan-500/10"
          style={{ animation: "orbit 2.5s linear infinite" }}
        >
          <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-200/70" />
        </div>
        {/* Radar sweep */}
        <div
          className="absolute w-32 h-32 rounded-full overflow-hidden"
          style={{ animation: "radar-sweep 3s linear infinite" }}
        >
          <div className="absolute top-0 left-1/2 w-1/2 h-1/2 origin-bottom-left"
            style={{ background: "conic-gradient(from 0deg, transparent 0deg, oklch(0.7 0.15 195 / 15%) 40deg, transparent 80deg)" }} />
        </div>
        {/* Center core */}
        <div className="relative w-4 h-4 rounded-full bg-cyan-400/80" style={{ boxShadow: "0 0 20px oklch(0.7 0.15 195 / 60%), 0 0 40px oklch(0.7 0.15 195 / 25%)" }}>
          <span className="absolute inset-0 rounded-full bg-cyan-400/40 animate-ring-expand" />
        </div>
      </div>

      {/* Status text block */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-cyan-400/70"
          style={{ animation: "status-blink 1.5s ease-in-out infinite" }}>
          Acquiring satellite imagery
        </p>
        {/* Progress bar */}
        <div className="w-40 h-[2px] rounded-full bg-cyan-500/10 overflow-hidden">
          {progress > 0 ? (
            <div
              className="h-full bg-gradient-to-r from-cyan-500/60 to-cyan-400 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          ) : (
            <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent rounded-full"
              style={{ animation: "progress-indeterminate 1.5s ease-in-out infinite" }} />
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono tabular-nums text-cyan-400/40">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60"
            style={{ animation: "status-blink 1s ease-in-out infinite" }} />
          {progress > 0 ? `${Math.round(progress)}% LOADED` : "CONNECTING"}
        </div>
      </div>
    </div>
  )
}

export default function WorldMap({
  hotspots,
  seismicEvents,
  gdeltEvents,
  gdacsAlerts,
  focusTarget,
  externalSelectedHotspot,
  externalSelectedSeismic,
  onCameraMove,
}: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<CesiumViewer>(null)
  const collectionsRef = useRef<PrimitiveCollections | null>(null)
  const dataRef = useRef({ hotspots, seismicEvents, gdeltEvents, gdacsAlerts })
  dataRef.current = { hotspots, seismicEvents, gdeltEvents, gdacsAlerts }
  const lastFocusRef = useRef<string>("")

  const [globeReady, setGlobeReady] = useState(false)
  const [tileProgress, setTileProgress] = useState(0)

  const [selectedHotspot, setSelectedHotspot] = useState<FirmsHotspot | null>(null)
  const [selectedSeismic, setSelectedSeismic] = useState<(SeismicEvent & { suspicious: boolean }) | null>(null)
  const [selectedGdelt, setSelectedGdelt] = useState<GdeltEvent | null>(null)
  const [selectedGdacs, setSelectedGdacs] = useState<GdacsAlert | null>(null)

  // Sync external selections
  useEffect(() => {
    if (externalSelectedHotspot) {
      setSelectedHotspot(externalSelectedHotspot)
      setSelectedSeismic(null)
      setSelectedGdelt(null)
      setSelectedGdacs(null)
    }
  }, [externalSelectedHotspot])

  useEffect(() => {
    if (externalSelectedSeismic) {
      setSelectedSeismic(externalSelectedSeismic)
      setSelectedHotspot(null)
      setSelectedGdelt(null)
      setSelectedGdacs(null)
    }
  }, [externalSelectedSeismic])

  // Show highlight marker for selected items
  useEffect(() => {
    const collections = collectionsRef.current
    const Cesium = (window as Record<string, CesiumModule>).Cesium
    if (!collections || !Cesium) return

    collections.highlightPoints.removeAll()
    collections.highlightLabels.removeAll()

    const sel = selectedHotspot || selectedSeismic || selectedGdelt || selectedGdacs
    if (!sel) return

    const lat = (sel as { latitude: number }).latitude
    const lng = (sel as { longitude: number }).longitude
    if (lat == null || lng == null) return

    const position = Cesium.Cartesian3.fromDegrees(lng, lat, 200)

    let dotColor = Cesium.Color.WHITE
    if (selectedHotspot) {
      const [r, g, b] = getClassColor(selectedHotspot.classification)
      dotColor = new Cesium.Color(r, g, b, 1.0)
    } else if (selectedSeismic) {
      dotColor = new Cesium.Color(0.7, 0.3, 1.0, 1.0)
    } else if (selectedGdelt) {
      dotColor = Cesium.Color.CYAN
    } else if (selectedGdacs) {
      dotColor = Cesium.Color.ORANGE
    }

    collections.highlightPoints.add({
      position,
      pixelSize: 32,
      color: dotColor.withAlpha(0.15),
      outlineColor: dotColor.withAlpha(0.6),
      outlineWidth: 2,
    })

    collections.highlightPoints.add({
      position,
      pixelSize: 14,
      color: dotColor,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
    })

    collections.highlightLabels.add({
      position,
      text: "▼",
      font: "bold 18px sans-serif",
      fillColor: dotColor,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -32),
    })
  }, [selectedHotspot, selectedSeismic, selectedGdelt, selectedGdacs])

  // Initialize Cesium viewer
  useEffect(() => {
    if (!containerRef.current) return

    let viewer: CesiumViewer = null
    let destroyed = false

    async function init() {
      const Cesium = await import("cesium")
      if (destroyed) return

      ;(window as Record<string, CesiumModule>).CESIUM_BASE_URL = "/cesium/"
      ;(window as Record<string, CesiumModule>).Cesium = Cesium

      const esriImagery = new Cesium.UrlTemplateImageryProvider({
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        maximumLevel: 17,
        credit: "Esri, Maxar, Earthstar Geographics",
      })

      viewer = new Cesium.Viewer(containerRef.current!, {
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        infoBox: false,
        timeline: false,
        animation: false,
        fullscreenButton: false,
        navigationHelpButton: false,
        creditContainer: document.createElement("div"),
        // @ts-expect-error — runtime-valid Cesium option removed from types in v1.139
        imageryProvider: false,
        skyBox: false as unknown as undefined,
        skyAtmosphere: new Cesium.SkyAtmosphere(),
        contextOptions: {
          webgl: { alpha: false },
        },
      })

      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#0a0a0f")
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#111118")

      const layer = viewer.imageryLayers.addImageryProvider(esriImagery)
      layer.brightness = 0.55
      layer.contrast = 1.15
      layer.saturation = 0.5

      viewer.scene.globe.enableLighting = false
      viewer.scene.globe.showGroundAtmosphere = true
      viewer.scene.globe.tileCacheSize = 200
      esriImagery.errorEvent.addEventListener(() => {})

      const firePoints = new Cesium.PointPrimitiveCollection()
      const suspectGlow = new Cesium.PointPrimitiveCollection()
      const suspectCore = new Cesium.PointPrimitiveCollection()
      const seismicPoints = new Cesium.PointPrimitiveCollection()
      const seismicLabels = new Cesium.LabelCollection()
      const gdeltPoints = new Cesium.PointPrimitiveCollection()
      const gdeltLabels = new Cesium.LabelCollection()
      const gdacsPoints = new Cesium.PointPrimitiveCollection()
      const gdacsLabels = new Cesium.LabelCollection()
      const highlightPoints = new Cesium.PointPrimitiveCollection()
      const highlightLabels = new Cesium.LabelCollection()

      const primitives = viewer.scene.primitives
      primitives.add(firePoints)
      primitives.add(suspectGlow)
      primitives.add(suspectCore)
      primitives.add(seismicPoints)
      primitives.add(seismicLabels)
      primitives.add(gdeltPoints)
      primitives.add(gdeltLabels)
      primitives.add(gdacsPoints)
      primitives.add(gdacsLabels)
      primitives.add(highlightPoints)
      primitives.add(highlightLabels)

      collectionsRef.current = {
        firePoints, suspectGlow, suspectCore,
        seismicPoints, seismicLabels,
        gdeltPoints, gdeltLabels,
        gdacsPoints, gdacsLabels,
        highlightPoints, highlightLabels,
      }

      viewerRef.current = viewer

      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(50, 30, 30000000),
      })

      // Track tile loading progress
      let peakQueue = 0
      let readyFired = false
      viewer.scene.globe.tileLoadProgressEvent.addEventListener((queueLength: number) => {
        if (readyFired) return
        if (queueLength > peakQueue) peakQueue = queueLength
        if (peakQueue > 0) {
          const pct = Math.round(((peakQueue - queueLength) / peakQueue) * 100)
          setTileProgress(pct)
        }
        if (queueLength === 0 && peakQueue > 0) {
          readyFired = true
          setTileProgress(100)
          setTimeout(() => setGlobeReady(true), 600)
        }
      })

      // Pulse animations
      viewer.scene.preRender.addEventListener(() => {
        const collections = collectionsRef.current
        if (!collections) return
        const pulse = 0.5 + 0.5 * Math.sin((Date.now() % 2000) / 2000 * Math.PI * 2)

        for (let i = 0; i < collections.suspectGlow.length; i++) {
          const p = collections.suspectGlow.get(i)
          p.pixelSize = 20 + pulse * 10
          p.color = Cesium.Color.RED.withAlpha(0.15 + pulse * 0.15)
        }

        for (let i = 0; i < collections.seismicPoints.length; i++) {
          const p = collections.seismicPoints.get(i)
          if (p._isSuspicious) {
            p.pixelSize = (p._baseSize || 8) + pulse * 4
          }
        }

        for (let i = 0; i < collections.gdacsPoints.length; i++) {
          const p = collections.gdacsPoints.get(i)
          if (p._isRed) {
            p.pixelSize = (p._baseSize || 10) + pulse * 4
          }
        }

        for (let i = 0; i < collections.highlightPoints.length; i++) {
          const p = collections.highlightPoints.get(i)
          p.pixelSize = 16 + pulse * 8
          p.outlineWidth = 2 + pulse * 2
        }
      })

      // Camera move listener
      const reportCameraCenter = () => {
        if (!viewer || viewer.isDestroyed() || !onCameraMove) return
        const cartographic = viewer.camera.positionCartographic
        if (cartographic) {
          onCameraMove({
            lat: Cesium.Math.toDegrees(cartographic.latitude),
            lng: Cesium.Math.toDegrees(cartographic.longitude),
          })
        }
      }
      viewer.camera.moveEnd.addEventListener(reportCameraCenter)
      reportCameraCenter()

      // Click handler
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
      handler.setInputAction((click: { position: { x: number; y: number } }) => {
        const picked = viewer.scene.pick(click.position)
        const userData = picked?.primitive?._userData || picked?.id?._userData
        if (userData) {
          const clearAll = () => {
            setSelectedHotspot(null)
            setSelectedSeismic(null)
            setSelectedGdelt(null)
            setSelectedGdacs(null)
          }
          clearAll()
          if (userData.type === "hotspot") setSelectedHotspot(userData.data)
          else if (userData.type === "seismic") setSelectedSeismic(userData.data)
          else if (userData.type === "gdelt") setSelectedGdelt(userData.data)
          else if (userData.type === "gdacs") setSelectedGdacs(userData.data)
        } else {
          setSelectedHotspot(null)
          setSelectedSeismic(null)
          setSelectedGdelt(null)
          setSelectedGdacs(null)
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

      updatePrimitives(Cesium)
    }

    init()

    return () => {
      destroyed = true
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy()
      }
      viewerRef.current = null
      collectionsRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updatePrimitives = useCallback((CesiumModule?: CesiumModule) => {
    const Cesium = CesiumModule || (window as Record<string, CesiumModule>).Cesium
    const collections = collectionsRef.current
    if (!Cesium || !collections) return

    const { hotspots, seismicEvents, gdeltEvents, gdacsAlerts } = dataRef.current

    // --- Fire hotspots ---
    collections.firePoints.removeAll()
    collections.suspectGlow.removeAll()
    collections.suspectCore.removeAll()

    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const visible = hotspots.filter((h) => {
      if (!h.acq_date) return true
      const time = h.acq_time?.padStart(4, "0") || "0000"
      const ts = Date.parse(`${h.acq_date}T${time.slice(0, 2)}:${time.slice(2, 4)}:00Z`)
      return isNaN(ts) || ts >= oneHourAgo
    })

    for (const h of visible) {
      const position = Cesium.Cartesian3.fromDegrees(h.longitude, h.latitude, 100)
      const [r, g, b] = getClassColor(h.classification)

      if (h.classification === "launch_suspect") {
        const glow = collections.suspectGlow.add({
          position, pixelSize: 24, color: Cesium.Color.RED.withAlpha(0.2),
        })
        glow._userData = { type: "hotspot", data: h }

        const core = collections.suspectCore.add({
          position, pixelSize: 8, color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE, outlineWidth: 2,
        })
        core._userData = { type: "hotspot", data: h }
      } else if (h.classification === "high_intensity") {
        const p = collections.firePoints.add({
          position, pixelSize: 6,
          color: new Cesium.Color(r, g, b, 0.9),
          outlineColor: new Cesium.Color(r, g, b, 0.3), outlineWidth: 3,
        })
        p._userData = { type: "hotspot", data: h }
      } else {
        const p = collections.firePoints.add({
          position, pixelSize: h.frp > 10 ? 4 : 3,
          color: new Cesium.Color(r, g, b, 0.65),
        })
        p._userData = { type: "hotspot", data: h }
      }
    }

    // --- Seismic events ---
    collections.seismicPoints.removeAll()
    collections.seismicLabels.removeAll()

    for (const e of seismicEvents) {
      const position = Cesium.Cartesian3.fromDegrees(e.longitude, e.latitude, 100)
      const radius = Math.max(4, Math.min(12, (e.magnitude || 1) * 2))

      const p = collections.seismicPoints.add({
        position, pixelSize: radius,
        color: e.suspicious
          ? Cesium.Color.fromCssColorString("#a855f7")
          : Cesium.Color.fromCssColorString("#7c3aed").withAlpha(0.5),
        outlineColor: e.suspicious
          ? Cesium.Color.fromCssColorString("#a855f7").withAlpha(0.3)
          : Cesium.Color.TRANSPARENT,
        outlineWidth: e.suspicious ? 4 : 0,
      })
      p._userData = { type: "seismic", data: e }
      p._isSuspicious = e.suspicious
      p._baseSize = radius

      if (e.magnitude >= 3) {
        const label = collections.seismicLabels.add({
          position,
          text: `M${e.magnitude?.toFixed(1)}`,
          font: "bold 11px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -radius - 8),
        })
        label._userData = { type: "seismic", data: e }
      }
    }

    // --- GDELT conflict events ---
    collections.gdeltPoints.removeAll()
    collections.gdeltLabels.removeAll()

    for (const e of gdeltEvents) {
      const position = Cesium.Cartesian3.fromDegrees(e.longitude, e.latitude, 100)
      const size = Math.max(4, Math.min(10, 3 + Math.log2(e.count + 1)))

      const p = collections.gdeltPoints.add({
        position, pixelSize: size,
        color: Cesium.Color.fromCssColorString("#22d3ee").withAlpha(0.75),
        outlineColor: Cesium.Color.fromCssColorString("#22d3ee").withAlpha(0.25), outlineWidth: 3,
      })
      p._userData = { type: "gdelt", data: e }

      if (e.count >= 5) {
        const label = collections.gdeltLabels.add({
          position,
          text: e.name.slice(0, 20),
          font: "10px sans-serif",
          fillColor: Cesium.Color.fromCssColorString("#22d3ee"),
          outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -size - 6),
        })
        label._userData = { type: "gdelt", data: e }
      }
    }

    // --- GDACS disaster alerts ---
    collections.gdacsPoints.removeAll()
    collections.gdacsLabels.removeAll()

    for (const a of gdacsAlerts) {
      const position = Cesium.Cartesian3.fromDegrees(a.longitude, a.latitude, 100)
      const isRed = a.alertLevel === "Red"
      const isOrange = a.alertLevel === "Orange"
      const baseSize = isRed ? 12 : isOrange ? 9 : 6

      const alertColor = isRed
        ? Cesium.Color.fromCssColorString("#ef4444")
        : isOrange
        ? Cesium.Color.fromCssColorString("#f59e0b")
        : Cesium.Color.fromCssColorString("#22c55e")

      const p = collections.gdacsPoints.add({
        position, pixelSize: baseSize, color: alertColor,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.5), outlineWidth: 2,
      })
      p._userData = { type: "gdacs", data: a }
      p._isRed = isRed
      p._baseSize = baseSize

      if (isRed || isOrange) {
        const label = collections.gdacsLabels.add({
          position,
          text: `${a.eventTypeName}${a.severity ? ` ${a.severity.toFixed?.(1) || a.severity}` : ""}`,
          font: `bold ${isRed ? "12" : "10"}px sans-serif`,
          fillColor: alertColor,
          outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -baseSize - 8),
        })
        label._userData = { type: "gdacs", data: a }
      }
    }
  }, [])

  useEffect(() => {
    updatePrimitives()
  }, [hotspots, seismicEvents, gdeltEvents, gdacsAlerts, updatePrimitives])

  // Fly to target
  useEffect(() => {
    const viewer = viewerRef.current
    const Cesium = (window as Record<string, CesiumModule>).Cesium
    if (!viewer || !Cesium || !focusTarget) return

    const key = `${focusTarget.lat},${focusTarget.lng}`
    if (key === lastFocusRef.current) return
    lastFocusRef.current = key

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(focusTarget.lng, focusTarget.lat, 15000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
      duration: 1.5,
    })
  }, [focusTarget])

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {!globeReady && <GlobeLoadingOverlay progress={tileProgress} />}

      {selectedHotspot && (
        <Popup
          position={{ lat: selectedHotspot.latitude, lng: selectedHotspot.longitude }}
          onClose={() => setSelectedHotspot(null)}
          viewerRef={viewerRef}
        >
          <h3 className="font-bold font-mono text-xs tracking-wide mb-2" style={{ color: getClassColorHex(selectedHotspot.classification) }}>
            {getClassLabel(selectedHotspot.classification)}
          </h3>
          <div className="space-y-1 text-[11px] font-mono">
            <p><span className="text-muted-foreground/50">LOC</span> <span className="text-foreground/80 tabular-nums">{selectedHotspot.latitude.toFixed(4)}, {selectedHotspot.longitude.toFixed(4)}</span></p>
            <p><span className="text-muted-foreground/50">CONF</span> <span className="text-foreground/80">{selectedHotspot.confidence}</span></p>
            <p><span className="text-muted-foreground/50">TEMP</span> <span className="text-foreground/80 tabular-nums">{selectedHotspot.bright_ti4.toFixed(1)}K</span></p>
            <p><span className="text-muted-foreground/50">FRP</span> <span className="text-foreground/80 tabular-nums">{selectedHotspot.frp.toFixed(1)} MW</span></p>
            <p><span className="text-muted-foreground/50">SAT</span> <span className="text-foreground/80">{selectedHotspot.satellite}</span></p>
            <p><span className="text-muted-foreground/50">TIME</span> <span className="text-foreground/80 tabular-nums">{selectedHotspot.acq_date} {selectedHotspot.acq_time}</span></p>
          </div>
        </Popup>
      )}

      {selectedSeismic && (
        <Popup
          position={{ lat: selectedSeismic.latitude, lng: selectedSeismic.longitude }}
          onClose={() => setSelectedSeismic(null)}
          viewerRef={viewerRef}
        >
          <h3 className="font-bold font-mono text-xs tracking-wide mb-2" style={{ color: selectedSeismic.suspicious ? "#a855f7" : "#7c3aed" }}>
            {selectedSeismic.suspicious ? "SUSPICIOUS SEISMIC EVENT" : "Seismic Event"}
          </h3>
          <div className="space-y-1 text-[11px] font-mono">
            <p><span className="text-muted-foreground/50">MAG</span> <span className="text-foreground/80 tabular-nums">M{selectedSeismic.magnitude?.toFixed(1)}</span></p>
            <p>
              <span className="text-muted-foreground/50">DEPTH</span> <span className="text-foreground/80 tabular-nums">{selectedSeismic.depth?.toFixed(1)} km</span>
              {selectedSeismic.depth < 5 && <span className="text-red-400 font-bold"> SHALLOW</span>}
            </p>
            <p><span className="text-muted-foreground/50">TYPE</span> <span className="text-foreground/80">{selectedSeismic.type}</span></p>
            <p><span className="text-muted-foreground/50">LOC</span> <span className="text-foreground/80">{selectedSeismic.place}</span></p>
            <p><span className="text-muted-foreground/50">TIME</span> <span className="text-foreground/80 tabular-nums">{new Date(selectedSeismic.time).toLocaleString()}</span></p>
          </div>
        </Popup>
      )}

      {selectedGdelt && (
        <Popup
          position={{ lat: selectedGdelt.latitude, lng: selectedGdelt.longitude }}
          onClose={() => setSelectedGdelt(null)}
          viewerRef={viewerRef}
        >
          <h3 className="font-bold font-mono text-xs tracking-wide mb-2 text-cyan-400">OSINT EVENT (GDELT)</h3>
          <div className="space-y-1 text-[11px] font-mono">
            <p><span className="text-muted-foreground/50">LOC</span> <span className="text-foreground/80">{selectedGdelt.name}</span></p>
            <p><span className="text-muted-foreground/50">HITS</span> <span className="text-foreground/80 tabular-nums">{selectedGdelt.count} mentions</span></p>
            <p><span className="text-muted-foreground/50">COORD</span> <span className="text-foreground/80 tabular-nums">{selectedGdelt.latitude.toFixed(4)}, {selectedGdelt.longitude.toFixed(4)}</span></p>
            {selectedGdelt.url && (
              <p><span className="text-muted-foreground/50">SRC</span> <span className="text-foreground/80">GDELT 15-min feed</span></p>
            )}
          </div>
        </Popup>
      )}

      {selectedGdacs && (
        <Popup
          position={{ lat: selectedGdacs.latitude, lng: selectedGdacs.longitude }}
          onClose={() => setSelectedGdacs(null)}
          viewerRef={viewerRef}
        >
          <h3
            className="font-bold font-mono text-xs tracking-wide mb-2"
            style={{
              color: selectedGdacs.alertLevel === "Red" ? "#ef4444"
                : selectedGdacs.alertLevel === "Orange" ? "#f59e0b"
                : "#22c55e"
            }}
          >
            {selectedGdacs.alertLevel.toUpperCase()} ALERT: {selectedGdacs.eventTypeName}
          </h3>
          <div className="space-y-1 text-[11px] font-mono">
            <p><span className="text-muted-foreground/50">TITLE</span> <span className="text-foreground/80">{selectedGdacs.title}</span></p>
            {selectedGdacs.country && (
              <p><span className="text-muted-foreground/50">COUNTRY</span> <span className="text-foreground/80">{selectedGdacs.country}</span></p>
            )}
            {selectedGdacs.severity > 0 && (
              <p><span className="text-muted-foreground/50">SEV</span> <span className="text-foreground/80 tabular-nums">{selectedGdacs.severity}</span></p>
            )}
            <p><span className="text-muted-foreground/50">COORD</span> <span className="text-foreground/80 tabular-nums">{selectedGdacs.latitude.toFixed(4)}, {selectedGdacs.longitude.toFixed(4)}</span></p>
            <p><span className="text-muted-foreground/50">SRC</span> <span className="text-foreground/80">GDACS</span></p>
          </div>
        </Popup>
      )}
    </div>
  )
}
