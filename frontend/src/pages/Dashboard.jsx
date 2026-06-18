import {
  Building2,
  FileCheck2,
  Gauge,
  ListOrdered,
  RefreshCw,
  Database,
  Server,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts'
import StatCard from '../components/StatCard.jsx'
import { CATEGORY_CHART_COLORS, ErrorState, LoadingState } from '../components/ui.jsx'
import { api } from '../api.js'
import { useCachedResource } from '../lib/cache.js'

function CategoryChart({ categories }) {
  const data = Object.entries(categories || {}).map(([name, count]) => ({
    name,
    count,
  }))

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        No moderation data yet.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          axisLine={{ stroke: '#334155' }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(148,163,184,0.08)' }}
          contentStyle={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 8,
            color: '#e2e8f0',
            fontSize: 12,
          }}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={64}>
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={CATEGORY_CHART_COLORS[entry.name] || '#6366f1'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function DependencyRow({ icon: Icon, label, value }) {
  const ok = value === 'ok'
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2.5">
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <Icon className="h-4 w-4 text-slate-500" />
        {label}
      </div>
      <span
        className={`flex items-center gap-1.5 text-xs font-medium ${
          ok ? 'text-emerald-400' : 'text-red-400'
        }`}
        title={typeof value === 'string' ? value : ''}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`}
        />
        {ok ? 'Connected' : 'Error'}
      </span>
    </div>
  )
}

export default function Dashboard({ health }) {
  const {
    data: stats,
    loading,
    refreshing,
    error,
    refetch: load,
  } = useCachedResource('dashboard', api.getDashboardStats, {
    refetchInterval: 10000,
  })

  const deps = (health && health.dependencies) || {}
  const avgPct =
    stats && stats.avg_confidence_score != null
      ? `${Math.round(stats.avg_confidence_score * 100)}%`
      : '—'

  return (
    <div className="space-y-6">
      {/* Refresh control */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Live overview · auto-refreshes every 10s
        </p>
        <button onClick={load} className="btn-ghost" disabled={refreshing}>
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      {error && !stats ? (
        <div className="card">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Building2}
              label="Total Platforms"
              value={stats?.total_platforms ?? 0}
              accent="brand"
              loading={loading}
            />
            <StatCard
              icon={FileCheck2}
              label="Moderation Results"
              value={stats?.total_moderation_results ?? 0}
              accent="sky"
              loading={loading}
            />
            <StatCard
              icon={Gauge}
              label="Avg Confidence"
              value={avgPct}
              accent="emerald"
              loading={loading}
            />
            <StatCard
              icon={ListOrdered}
              label="Queue Size"
              value={stats?.queue_size ?? 0}
              hint="pending in stream"
              accent="amber"
              loading={loading}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Category chart */}
            <div className="card p-5 lg:col-span-2">
              <h2 className="mb-1 text-sm font-semibold text-white">
                Category Distribution
              </h2>
              <p className="mb-4 text-xs text-slate-500">
                Breakdown of moderated content by category
              </p>
              {loading ? (
                <LoadingState label="Loading chart…" />
              ) : (
                <CategoryChart categories={stats?.categories} />
              )}
            </div>

            {/* Health panel */}
            <div className="card p-5">
              <h2 className="mb-1 text-sm font-semibold text-white">
                System Health
              </h2>
              <p className="mb-4 text-xs text-slate-500">
                Backend service dependencies
              </p>
              {health === false ? (
                <p className="rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                  API gateway is unreachable.
                </p>
              ) : health === null ? (
                <p className="text-sm text-slate-500">Checking…</p>
              ) : (
                <div className="space-y-2">
                  <DependencyRow
                    icon={Server}
                    label="Redis"
                    value={deps.redis}
                  />
                  <DependencyRow
                    icon={Database}
                    label="Database"
                    value={deps.database}
                  />
                  <div className="mt-3 rounded-lg bg-surface-raised px-3 py-2.5 text-xs text-slate-400">
                    Service:{' '}
                    <span className="text-slate-200">
                      {health.service || 'unknown'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
