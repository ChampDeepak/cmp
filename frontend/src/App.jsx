import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Moderate from './pages/Moderate.jsx'
import Results from './pages/Results.jsx'
import Platforms from './pages/Platforms.jsx'
import { api } from './api.js'

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
      className="flex items-center gap-2 rounded-full border border-surface-border bg-surface-raised/70 px-3 py-1.5 text-xs font-medium text-slate-300 backdrop-blur transition-all duration-300 hover:border-brand/40 hover:bg-surface-raised hover:text-white"
    >
      <span className="relative flex h-2 w-2">
        {(health === null || (health && health.status === 'running')) && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dot}`}
          />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full shadow-[0_0_8px_currentColor] transition-colors duration-300 ${dot}`}
        />
      </span>
      <span className="transition-colors duration-300">{label}</span>
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
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-surface-border/70 bg-surface-card/50 px-6 backdrop-blur-xl">
          <h1
            key={location.pathname}
            className="animate-fade-in text-lg font-semibold tracking-tight text-white"
          >
            {title}
          </h1>
          <div className="flex items-center gap-3">
            <HealthPill health={health} />
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 overflow-y-auto p-6">
          <div
            key={location.pathname}
            className="mx-auto max-w-7xl animate-fade-in"
          >
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
        <footer className="flex h-9 shrink-0 items-center justify-between border-t border-surface-border/70 bg-surface-card/50 px-6 text-xs text-slate-600 backdrop-blur">
          <span className="transition-colors duration-300 hover:text-slate-400">
            ModGuard Admin · AI Content Moderation
          </span>
        </footer>
      </div>
    </div>
  )
}
