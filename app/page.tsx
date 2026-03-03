"use client"

import { useState, useEffect, useRef, type FormEvent } from "react"

/* ─── useInView ─── */
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

/* ─── ESRI Satellite Tile helper ─── */
// Uses individual tiles from ESRI's World Imagery tile server
// Format: /tile/{z}/{y}/{x} — much more reliable than the export API
const TILE = (z: number, y: number, x: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`

/* ─── Detection scenario log lines ─── */
const SCENARIO_LINES = [
  { time: "14:23:07", text: "VIIRS/NOAA-20 pass initiated — scanning sector 4A", color: "text-white/30" },
  { time: "14:23:11", text: "Thermal anomaly detected: 34.0584°N, 118.2430°W", color: "text-amber-400/80" },
  { time: "14:23:11", text: "Brightness temp: 2,847K — exceeds 1,500K threshold", color: "text-orange-400/80" },
  { time: "14:23:12", text: "FRP reading: 342 MW — classified HIGH INTENSITY", color: "text-orange-400/90" },
  { time: "14:23:12", text: "Cross-referencing MODIS/Aqua + Suomi-NPP...", color: "text-white/30" },
  { time: "14:23:14", text: "3/3 sources confirm — upgrading to LAUNCH SUSPECT", color: "text-red-400" },
  { time: "14:23:14", text: "▸ Alert dispatched to 12 active operators", color: "text-red-400/80" },
]

export default function LandingPage() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [logLines, setLogLines] = useState(0)
  const scenario = useInView(0.4)
  const demo = useInView(0.3)
  const bottom = useInView(0.3)

  // Animate scenario log
  useEffect(() => {
    if (!scenario.visible) return
    let i = 0
    const iv = setInterval(() => {
      i++
      setLogLines(i)
      if (i >= SCENARIO_LINES.length) clearInterval(iv)
    }, 800)
    return () => clearInterval(iv)
  }, [scenario.visible])

  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setSubmitted(true)
      }
    } catch {
      // Silently fail — still show success to avoid blocking UX
      setSubmitted(true)
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-[#080a0f] text-foreground overflow-x-hidden">

      {/* ═══ HERO — real satellite tile mosaic background ═══ */}
      <section className="relative min-h-[80vh] sm:min-h-screen flex items-end pb-6 sm:pb-24 px-4 sm:px-12 overflow-hidden">
        {/* Satellite tile mosaic background */}
        <div className="absolute inset-0" aria-hidden>
          {/* Grid of ESRI satellite tiles — zoom 3, Middle East / Mediterranean region */}
          <div
            className="absolute inset-0 grid opacity-70"
            style={{
              gridTemplateColumns: "repeat(4, 1fr)",
              gridTemplateRows: "repeat(3, 1fr)",
            }}
          >
            {/* Row 0 (y=2): z3 tiles covering ~Mediterranean/Europe */}
            <img src={TILE(3, 2, 3)} alt="" className="w-full h-full object-cover" />
            <img src={TILE(3, 2, 4)} alt="" className="w-full h-full object-cover" />
            <img src={TILE(3, 2, 5)} alt="" className="w-full h-full object-cover" />
            <img src={TILE(3, 2, 6)} alt="" className="w-full h-full object-cover" />
            {/* Row 1 (y=3): Middle East / North Africa */}
            <img src={TILE(3, 3, 3)} alt="" className="w-full h-full object-cover" />
            <img src={TILE(3, 3, 4)} alt="" className="w-full h-full object-cover" />
            <img src={TILE(3, 3, 5)} alt="" className="w-full h-full object-cover" />
            <img src={TILE(3, 3, 6)} alt="" className="w-full h-full object-cover" />
            {/* Row 2 (y=4): Sub-Saharan Africa / Indian Ocean */}
            <img src={TILE(3, 4, 3)} alt="" className="w-full h-full object-cover" />
            <img src={TILE(3, 4, 4)} alt="" className="w-full h-full object-cover" />
            <img src={TILE(3, 4, 5)} alt="" className="w-full h-full object-cover" />
            <img src={TILE(3, 4, 6)} alt="" className="w-full h-full object-cover" />
          </div>

          {/* Dark overlay gradients — bottom & left heavy so text is readable */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#080a0f] via-[#080a0f]/80 to-[#080a0f]/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#080a0f]/70 via-transparent to-transparent" />
          {/* Slight color tint */}
          <div className="absolute inset-0 bg-[#080a0f]/30" />

          {/* Scan line */}
          <div
            className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent"
            style={{ animation: "scan-line 8s ease-in-out infinite" }}
          />
        </div>

        {/* Detection markers overlaid on satellite imagery */}
        <div className="absolute inset-0 pointer-events-none hidden sm:block" aria-hidden>
          {[
            { x: "62%", y: "22%", c: "#ef4444", label: "SUSPECT", pulse: true },
            { x: "45%", y: "38%", c: "#ff8c00", label: "", pulse: false },
            { x: "71%", y: "48%", c: "#ff8c00", label: "", pulse: false },
            { x: "35%", y: "18%", c: "#ffcc00", label: "", pulse: false },
            { x: "55%", y: "32%", c: "#ffcc00", label: "", pulse: false },
            { x: "80%", y: "30%", c: "#a855f7", label: "M4.7", pulse: false },
            { x: "28%", y: "55%", c: "#ff8c00", label: "", pulse: false },
            { x: "48%", y: "65%", c: "#22d3ee", label: "OSINT", pulse: false },
          ].map((d, i) => (
            <div key={i} className="absolute" style={{ left: d.x, top: d.y }}>
              {/* Expanding ring for suspect */}
              {d.pulse && (
                <span
                  className="absolute -inset-3 rounded-full border border-red-500/30"
                  style={{ animation: "ring-expand 2s ease-out infinite" }}
                />
              )}
              <span
                className="block w-2.5 h-2.5 rounded-full"
                style={{
                  background: d.c,
                  boxShadow: `0 0 16px ${d.c}90, 0 0 6px ${d.c}`,
                  animation: d.pulse ? "glow-pulse 1.5s ease-in-out infinite" : undefined,
                }}
              />
              {d.label && (
                <span
                  className="absolute left-4 top-[-3px] text-[9px] font-mono font-bold tracking-wider whitespace-nowrap"
                  style={{ color: d.c }}
                >
                  {d.label}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Top branding */}
        <div className="absolute top-4 left-4 sm:top-6 sm:left-12 z-10 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ boxShadow: "0 0 6px oklch(0.7 0.15 195 / 60%)" }} />
          <span className="text-[11px] font-mono font-bold tracking-[0.2em] text-white/40">SATZON</span>
        </div>

        {/* Content — left-aligned */}
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-3 mb-4 sm:mb-8">
            <div className="w-2 h-2 rounded-full bg-red-500" style={{ animation: "glow-pulse 1.5s ease-in-out infinite", boxShadow: "0 0 8px #ef444490" }} />
            <span className="text-[11px] font-mono tracking-wider text-red-400/80 uppercase">Live global monitoring</span>
          </div>

          <h1 className="text-[22px] sm:text-5xl md:text-6xl font-sans font-bold leading-[1.15] tracking-tight text-white mb-4 sm:mb-5">
            See what satellites see.<br />
            <span className="text-white/50">Before anyone else.</span>
          </h1>

          <p className="text-[13px] sm:text-base text-white/45 max-w-lg mb-5 sm:mb-10 leading-relaxed">
            Real-time satellite intelligence platform. Satzon monitors thermal anomalies,
            earthquakes, OSINT signals, and disaster alerts from 5 NASA satellites —
            all on one live dashboard. Detect rocket launches, wildfires,
            and seismic events in under 8 seconds.
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-2 w-full sm:max-w-sm">
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full sm:flex-1 h-12 sm:h-10 px-4 rounded-lg sm:rounded bg-white/[0.08] border border-white/15 text-[15px] sm:text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:bg-white/[0.1] transition-all"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto h-12 sm:h-10 px-5 rounded-lg sm:rounded bg-white text-black text-[15px] sm:text-sm font-semibold hover:bg-white/90 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {submitting ? "Joining..." : "Get early access"}
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2 text-sm text-green-400/80 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              You&apos;re on the list. We&apos;ll be in touch.
            </div>
          )}

          <p className="mt-4 text-[11px] text-green-400/50 font-mono">
            ⚡ First 1,000 signups get free access
          </p>
        </div>
      </section>

      {/* ═══ LIVE TICKER ═══ */}
      <div className="border-t border-white/[0.06] py-2.5 overflow-hidden bg-white/[0.015]">
        <div className="flex whitespace-nowrap" style={{ animation: "marquee 50s linear infinite" }}>
          {[
            "VIIRS · 34.05°N 118.24°W · 2,847K · SUSPECT",
            "USGS · M5.2 · 35.68°N 139.69°E · 12km",
            "MODIS · 28.61°N 77.23°E · 1,420K · HIGH",
            "GDELT · 847 mentions · London, UK",
            "GDACS · Red Alert · Earthquake 7.1M · Chile",
            "VIIRS · 55.75°N 37.62°E · 3,102K · SUSPECT",
            "USGS · M4.8 · 37.77°N 122.42°W · 8km",
            "MODIS · 1.35°N 103.82°E · 1,780K · HIGH",
            "VIIRS · 34.05°N 118.24°W · 2,847K · SUSPECT",
            "USGS · M5.2 · 35.68°N 139.69°E · 12km",
            "MODIS · 28.61°N 77.23°E · 1,420K · HIGH",
            "GDELT · 847 mentions · London, UK",
          ].map((t, i) => (
            <span key={i} className="text-[10px] font-mono text-white/20 mx-8">{t}</span>
          ))}
        </div>
      </div>

      {/* ═══ SCENARIO: LAUNCH DETECTION ═══ */}
      <section className="py-14 sm:py-32 px-4 sm:px-12">
        <div ref={scenario.ref} className="max-w-5xl mx-auto">
          <p className="text-[11px] font-mono text-white/25 tracking-wider uppercase mb-4">Real scenario</p>
          <h2 className="text-xl sm:text-3xl font-sans font-bold text-white/90 mb-3">
            How Satzon detects a launch in under 8 seconds
          </h2>
          <p className="text-sm text-white/35 max-w-2xl mb-12">
            A satellite passes over the Middle East. Multiple sensors flag an extreme thermal reading.
            Here&apos;s what happens next — automatically, no human intervention.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: satellite view with detection overlay — real tiles */}
            <div className="relative rounded-lg overflow-hidden border border-white/[0.08]">
              {/* 2x2 grid of ESRI tiles at zoom 7, Middle East area */}
              <div className="grid grid-cols-2 grid-rows-2 h-56 sm:h-80">
                <img src={TILE(7, 50, 78)} alt="" className="w-full h-full object-cover" />
                <img src={TILE(7, 50, 79)} alt="" className="w-full h-full object-cover" />
                <img src={TILE(7, 51, 78)} alt="" className="w-full h-full object-cover" />
                <img src={TILE(7, 51, 79)} alt="" className="w-full h-full object-cover" />
              </div>
              {/* Dark overlay for HUD visibility */}
              <div className="absolute inset-0 bg-black/40" />

              {/* Detection marker — center */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="absolute -inset-10 rounded-full border border-red-500/20" style={{ animation: "ring-expand 2.5s ease-out infinite" }} />
                <span className="absolute -inset-5 rounded-full border border-red-500/30" style={{ animation: "ring-expand 2s ease-out infinite 0.5s" }} />
                <span className="block w-4 h-4 rounded-full bg-red-500" style={{ boxShadow: "0 0 20px #ef4444aa, 0 0 60px #ef444444" }} />
              </div>

              {/* Crosshair lines */}
              <div className="absolute top-1/2 left-0 right-0 h-px bg-red-500/15" />
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-red-500/15" />

              {/* HUD text overlays */}
              <div className="absolute top-3 left-3 text-[9px] font-mono text-white/40 space-y-0.5">
                <p>VIIRS/NOAA-20</p>
                <p>PASS 4A · 14:23 UTC</p>
              </div>
              <div className="absolute top-3 right-3 text-[9px] font-mono text-red-400/80 text-right">
                <p>2,847K</p>
                <p>342 MW</p>
              </div>
              <div className="absolute bottom-3 left-3 text-[9px] font-mono text-white/30">
                34.0584°N, 118.2430°W
              </div>
              <div className="absolute bottom-3 right-3">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                  LAUNCH SUSPECT
                </span>
              </div>
            </div>

            {/* Right: terminal log */}
            <div className="rounded-lg border border-white/[0.08] bg-[#0c0e14] p-3 sm:p-5 flex flex-col min-h-[240px] sm:min-h-0">
              <div className="flex items-center gap-2 mb-3 sm:mb-4 pb-3 border-b border-white/[0.06]">
                <span className="w-2 h-2 rounded-full bg-red-500/60" />
                <span className="w-2 h-2 rounded-full bg-yellow-500/40" />
                <span className="w-2 h-2 rounded-full bg-green-500/40" />
                <span className="text-[10px] font-mono text-white/20 ml-2">satzon — event log</span>
              </div>
              <div className="flex-1 space-y-1.5 font-mono text-[10px] sm:text-[11px] leading-relaxed overflow-hidden">
                {SCENARIO_LINES.slice(0, logLines).map((line, i) => (
                  <div key={i} className={`${line.color} transition-opacity duration-300`}>
                    <span className="text-white/20 mr-2">{line.time}</span>
                    {line.text}
                  </div>
                ))}
                {logLines > 0 && logLines < SCENARIO_LINES.length && (
                  <span className="inline-block w-1.5 h-3.5 bg-white/30 animate-pulse" />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ DATA SOURCES ═══ */}
      <section className="py-14 sm:py-28 px-4 sm:px-12 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl sm:text-3xl font-sans font-bold text-white/90 mb-10 sm:mb-16">
            Five data sources. One screen.
          </h2>

          <div className="space-y-px">
            {[
              {
                source: "FIRMS / VIIRS",
                what: "Thermal hotspots from 5 NASA satellites — every fire, every flare, every launch plume on Earth",
                stat: "121,000+",
                statLabel: "detections / day",
                accent: "#ff8c00",
              },
              {
                source: "USGS Seismic",
                what: "Global earthquake feed. Magnitude, depth, location. Shallow events under 5km auto-flagged as suspicious",
                stat: "300+",
                statLabel: "events / day",
                accent: "#a855f7",
              },
              {
                source: "GDELT",
                what: "Open-source intelligence. Global media monitoring updated every 15 minutes — 100M+ articles indexed",
                stat: "15 min",
                statLabel: "update cycle",
                accent: "#22d3ee",
              },
              {
                source: "GDACS",
                what: "UN disaster alerting system. Earthquakes, floods, cyclones, volcanoes — severity-classified in real time",
                stat: "51",
                statLabel: "active alerts",
                accent: "#f59e0b",
              },
              {
                source: "Classification Engine",
                what: "Cross-references all sources. A 2,800K thermal reading + shallow seismic event = potential launch. Auto-escalated",
                stat: "< 8s",
                statLabel: "detection time",
                accent: "#ef4444",
              },
            ].map((item) => (
              <div
                key={item.source}
                className="group flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 py-5 px-4 -mx-4 rounded-lg hover:bg-white/[0.02] transition-colors duration-200"
              >
                <div className="sm:w-36 shrink-0">
                  <span className="text-xs font-mono font-bold tracking-wider" style={{ color: item.accent }}>
                    {item.source}
                  </span>
                </div>
                <p className="flex-1 text-sm text-white/40 group-hover:text-white/55 transition-colors">
                  {item.what}
                </p>
                <div className="flex sm:block items-center gap-2 sm:w-32 shrink-0 sm:text-right">
                  <span className="text-base sm:text-lg font-mono font-bold text-white/70 tabular-nums">{item.stat}</span>
                  <span className="text-[10px] text-white/20 sm:block font-mono">{item.statLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ DASHBOARD DEMO — real satellite tiles ═══ */}
      <section className="py-14 sm:py-28 px-4 sm:px-12">
        <div ref={demo.ref} className={`max-w-5xl mx-auto transition-all duration-700 ${demo.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
          <p className="text-[11px] font-mono text-white/25 tracking-wider uppercase mb-4">The dashboard</p>
          <h2 className="text-xl sm:text-3xl font-sans font-bold text-white/90 mb-8 sm:mb-12">
            Everything on a 3D globe. Zoom in anywhere.
          </h2>

          {/* Dashboard mockup */}
          <div className="relative rounded-xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/50">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#0c0e14] border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ boxShadow: "0 0 6px oklch(0.7 0.15 195 / 60%)" }} />
                <span className="text-[10px] font-mono font-bold tracking-wider text-white/50">SATZON</span>
              </div>
              <div className="flex items-center gap-5">
                {[
                  { n: "75", l: "SUSPECT", c: "#ef4444" },
                  { n: "13,172", l: "HIGH", c: "#ff8c00" },
                  { n: "121,817", l: "TOTAL", c: "#22c55e" },
                  { n: "305", l: "SEISMIC", c: "#a855f7" },
                ].map((s) => (
                  <div key={s.l} className="hidden sm:flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full" style={{ background: s.c }} />
                    <span className="text-[10px] font-mono tabular-nums text-white/50">{s.n}</span>
                    <span className="text-[9px] font-mono text-white/20">{s.l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Main area — real satellite tile mosaic */}
            <div className="relative h-56 sm:h-[420px] overflow-hidden">
              {/* 6x3 grid of tiles at zoom 2 — global view */}
              <div
                className="absolute inset-0 grid"
                style={{
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gridTemplateRows: "repeat(3, 1fr)",
                }}
              >
                {/* Row 0 (y=1): Northern hemisphere */}
                <img src={TILE(2, 1, 0)} alt="" className="w-full h-full object-cover" />
                <img src={TILE(2, 1, 1)} alt="" className="w-full h-full object-cover" />
                <img src={TILE(2, 1, 2)} alt="" className="w-full h-full object-cover" />
                <img src={TILE(2, 1, 3)} alt="" className="w-full h-full object-cover" />
                <img src={TILE(2, 1, 0)} alt="" className="w-full h-full object-cover" />
                <img src={TILE(2, 1, 1)} alt="" className="w-full h-full object-cover" />
                {/* Row 1 (y=2): Equatorial */}
                <img src={TILE(2, 2, 0)} alt="" className="w-full h-full object-cover" />
                <img src={TILE(2, 2, 1)} alt="" className="w-full h-full object-cover" />
                <img src={TILE(2, 2, 2)} alt="" className="w-full h-full object-cover" />
                <img src={TILE(2, 2, 3)} alt="" className="w-full h-full object-cover" />
                <img src={TILE(2, 2, 0)} alt="" className="w-full h-full object-cover" />
                <img src={TILE(2, 2, 1)} alt="" className="w-full h-full object-cover" />
                {/* Row 2 (y=3): Southern hemisphere */}
                <img src={TILE(2, 3, 0)} alt="" className="w-full h-full object-cover" />
                <img src={TILE(2, 3, 1)} alt="" className="w-full h-full object-cover" />
                <img src={TILE(2, 3, 2)} alt="" className="w-full h-full object-cover" />
                <img src={TILE(2, 3, 3)} alt="" className="w-full h-full object-cover" />
                <img src={TILE(2, 3, 0)} alt="" className="w-full h-full object-cover" />
                <img src={TILE(2, 3, 1)} alt="" className="w-full h-full object-cover" />
              </div>
              {/* Dark overlay */}
              <div className="absolute inset-0 bg-black/35" />

              {/* Detection dots */}
              {[
                { x: "15%", y: "35%", c: "#ffcc00", s: 4 },
                { x: "22%", y: "55%", c: "#ffcc00", s: 3 },
                { x: "28%", y: "42%", c: "#ff8c00", s: 5 },
                { x: "35%", y: "30%", c: "#ff8c00", s: 4 },
                { x: "40%", y: "58%", c: "#ffcc00", s: 3 },
                { x: "48%", y: "38%", c: "#ef4444", s: 6 },
                { x: "52%", y: "48%", c: "#ff8c00", s: 4 },
                { x: "58%", y: "25%", c: "#a855f7", s: 5 },
                { x: "65%", y: "52%", c: "#ffcc00", s: 3 },
                { x: "70%", y: "35%", c: "#ef4444", s: 6 },
                { x: "75%", y: "45%", c: "#ff8c00", s: 4 },
                { x: "82%", y: "30%", c: "#a855f7", s: 5 },
                { x: "85%", y: "55%", c: "#ffcc00", s: 3 },
                { x: "50%", y: "70%", c: "#22d3ee", s: 4 },
                { x: "30%", y: "65%", c: "#f59e0b", s: 5 },
              ].map((d, i) => (
                <span
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    left: d.x, top: d.y,
                    width: d.s, height: d.s,
                    background: d.c,
                    boxShadow: `0 0 ${d.s * 3}px ${d.c}80`,
                    animation: `glow-pulse ${2 + (i % 3) * 0.5}s ease-in-out infinite ${i * 0.2}s`,
                  }}
                />
              ))}

              {/* Selected event popup — hidden on very small screens */}
              <div className="hidden sm:block absolute top-[34%] left-[48%] translate-x-2 -translate-y-full">
                <div className="bg-black/80 backdrop-blur border border-red-500/20 rounded-md px-3 py-2 text-[9px] font-mono shadow-lg shadow-red-500/5 whitespace-nowrap">
                  <p className="text-red-400 font-bold mb-0.5">LAUNCH SUSPECT</p>
                  <p className="text-white/40">34.06°N, 44.32°E · 2,847K</p>
                  <p className="text-white/40">FRP 342 MW · VIIRS</p>
                </div>
              </div>

              {/* Left control panel */}
              <div className="absolute top-2 left-2 sm:top-3 sm:left-3 w-28 sm:w-44 bg-black/60 backdrop-blur border border-white/[0.06] rounded-lg p-2 sm:p-3 space-y-1.5 sm:space-y-2">
                <div className="text-[8px] sm:text-[9px] font-mono text-cyan-400/60 tracking-wider">LAUNCH MONITOR</div>
                <div className="h-4 sm:h-5 rounded bg-red-500/10 border border-red-500/10 flex items-center px-1.5 sm:px-2">
                  <span className="text-[8px] sm:text-[9px] font-mono text-red-400/70">75 suspect events</span>
                </div>
                <div className="h-4 sm:h-5 rounded bg-orange-500/10 border border-orange-500/10 flex items-center px-1.5 sm:px-2">
                  <span className="text-[8px] sm:text-[9px] font-mono text-orange-400/60">13,172 high</span>
                </div>
                <div className="hidden sm:block text-[9px] font-mono text-cyan-400/60 tracking-wider mt-1">EVENT LOG</div>
                <div className="hidden sm:block space-y-1">
                  {["HIGH · 14 MW · Dominican Rep.", "FIRE · 19 MW · Haiti", "SUSPECT · 342 MW · Iraq"].map((t, i) => (
                    <div key={i} className="text-[8px] font-mono text-white/25 truncate">{t}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-white/20 mt-5 max-w-lg">
            Live data rendered on a 3D CesiumJS globe with ESRI/Maxar satellite imagery,
            click-to-inspect, country filtering, and real-time polling.
          </p>
        </div>
      </section>

      {/* ═══ BOTTOM CTA ═══ */}
      <section className="py-14 sm:py-28 px-4 sm:px-12 border-t border-white/[0.04]">
        <div ref={bottom.ref} className={`max-w-xl mx-auto text-center transition-all duration-700 ${bottom.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <h2 className="text-xl sm:text-3xl font-sans font-bold text-white/90 mb-3">
            Free access for the first 1,000
          </h2>
          <p className="text-sm text-white/35 mb-8">
            We&apos;re opening Satzon to the first 1,000 users for free.
            Drop your email and we&apos;ll send your access link.
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-2 w-full sm:max-w-sm mx-auto">
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full sm:flex-1 h-12 sm:h-10 px-4 rounded-lg sm:rounded bg-white/[0.08] border border-white/15 text-[15px] sm:text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:bg-white/[0.1] transition-all"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto h-12 sm:h-10 px-5 rounded-lg sm:rounded bg-white text-black text-[15px] sm:text-sm font-semibold hover:bg-white/90 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {submitting ? "Joining..." : "Join waitlist"}
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-green-400/80 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              You&apos;re on the list.
            </div>
          )}

          <div className="mt-16 pt-6 border-t border-white/[0.04] text-[11px] text-white/15 space-y-1">
            <p>Satzon — satellite intelligence platform</p>
            <p>Built for defense analysts, wildfire response, and OSINT researchers.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
