import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Activity } from 'lucide-react'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Moderate from './pages/Moderate.jsx'
import Results from './pages/Results.jsx'
import Platforms from './pages/Platforms.jsx'
import { api, API_URL } from './api.js'

const TITLES = {
  '/': 'Dashboard',
  '/moderate': 'Moderate Content',
  '/results': 'Moderation Results',
  '/platforms': 'Platforms',
}

function HealthPill({ health }) {
  // health: null = checking, false = unreachable, object = response
  let dot = 'bg-slate-500'
  let label = 'Checking…'
  let title = ''

  if (health === false) {
    dot = 'bg-red-500'
    label = 'API offline'
  } else if (health) {
    const deps = health.dependencies || {}
    const healthy = health.status === 'running'
    dot = healthy ? 'bg-emerald-500' : 'bg-amber-500'
    label = healthy ? 'Healthy' : 'Degraded'
    title = `redis: ${deps.redis || '?'} · database: ${deps.database || '?'}`
  }

  return (
    <div
      title={title}
      className="flex items-center gap-2 rounded-full border border-surface-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-slate-300"
    >
      <span className="relative flex h-2 w-2">
        {(health === null || (health && health.status === 'running')) && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dot}`}
          />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      {label}
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const [health, setHealth] = useState(null)
  const title = TITLES[location.pathname] || 'Dashboard'

  const checkHealth = useCallback(async () => {
    try {
      const h = await api.health()
      setHealth(h)
    } catch {
      setHealth(false)
    }
  }, [])

  useEffect(() => {
    checkHealth()
    const t = setInterval(checkHealth, 10000)
    return () => clearInterval(t)
  }, [checkHealth])

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-surface-border bg-surface-card/60 px-6 backdrop-blur">
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
              <Activity className="h-3.5 w-3.5" />
              {API_URL}
            </span>
            <HealthPill health={health} />
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl animate-fade-in">
            <Routes>
              <Route path="/" element={<Dashboard health={health} />} />
              <Route path="/moderate" element={<Moderate />} />
              <Route path="/results" element={<Results />} />
              <Route path="/platforms" element={<Platforms />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>

        {/* Footer */}
        <footer className="flex h-9 shrink-0 items-center justify-between border-t border-surface-border bg-surface-card px-6 text-xs text-slate-600">
          <span>ModGuard Admin · AI Content Moderation</span>
          <span className="font-mono">API: {API_URL}</span>
        </footer>
      </div>
    </div>
  )
}
