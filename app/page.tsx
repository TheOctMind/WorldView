import Dashboard from "@/components/dashboard"

// Page renders instantly as a thin server component shell.
// Dashboard (client) fires parallel fetches on mount — the FIRMS
// in-memory cache makes repeat loads <50ms.
export default function Page() {
  return <Dashboard />
}
