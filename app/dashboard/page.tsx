"use client"

import { useState, useEffect } from "react"
import Dashboard from "@/components/dashboard"

const LS_KEY = "worldview_access_key"

export default function DashboardPage() {
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)
  const [keyInput, setKeyInput] = useState("")
  const [error, setError] = useState("")

  // On mount: check URL param or localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlKey = params.get("key")
    const storedKey = localStorage.getItem(LS_KEY)
    const keyToCheck = urlKey || storedKey

    if (keyToCheck) {
      validateKey(keyToCheck)
    } else {
      setChecking(false)
    }
  }, [])

  async function validateKey(key: string) {
    setChecking(true)
    setError("")
    try {
      const res = await fetch("/api/dashboard-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      })
      const data = await res.json()
      if (data.valid) {
        localStorage.setItem(LS_KEY, key)
        // Clean up URL param if present
        if (window.location.search.includes("key=")) {
          window.history.replaceState({}, "", "/dashboard")
        }
        setAuthorized(true)
      } else {
        localStorage.removeItem(LS_KEY)
        setError("Invalid access key")
      }
    } catch {
      setError("Connection error. Try again.")
    }
    setChecking(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!keyInput.trim()) return
    validateKey(keyInput.trim())
  }

  // Loading state
  if (checking) {
    return (
      <div className="fixed inset-0 bg-[#080a0f] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-sm font-mono text-white/40">Verifying access...</span>
        </div>
      </div>
    )
  }

  // Authorized — show dashboard
  if (authorized) {
    return <Dashboard />
  }

  // Gate — ask for key
  return (
    <div className="fixed inset-0 bg-[#080a0f] flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        <div className="flex items-center gap-2 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ boxShadow: "0 0 6px oklch(0.7 0.15 195 / 60%)" }} />
          <span className="text-[11px] font-mono font-bold tracking-[0.2em] text-white/40">WORLDVIEW</span>
        </div>

        <h1 className="text-xl font-sans font-bold text-white/90 mb-2">
          Dashboard Access
        </h1>
        <p className="text-sm text-white/35 mb-8">
          Enter your access key to view the monitoring dashboard.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Enter access key"
            value={keyInput}
            onChange={(e) => { setKeyInput(e.target.value); setError("") }}
            autoFocus
            className="w-full h-10 px-3 rounded bg-white/[0.06] border border-white/10 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/25 transition-colors font-mono"
          />
          {error && (
            <p className="text-xs text-red-400 font-mono">{error}</p>
          )}
          <button
            type="submit"
            className="w-full h-10 rounded bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors cursor-pointer"
          >
            Access Dashboard
          </button>
        </form>

        <p className="mt-6 text-[11px] text-white/15 text-center">
          Don&apos;t have a key? <a href="/" className="text-white/30 hover:text-white/50 transition-colors underline underline-offset-2">Request access</a>
        </p>
      </div>
    </div>
  )
}
