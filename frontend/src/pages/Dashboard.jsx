import {
  Building2,
  FileCheck2,
  Gauge,
  ListOrdered,
  RefreshCw,
  Database,
  Server,
  Activity,
  BarChart3,
  PieChart,
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
          cursor={{ fill: 'rgba(139,92,246,0.12)', radius: 6 }}
          contentStyle={{
            background: 'rgba(30,41,59,0.95)',
            border: '1px solid #334155',
            borderRadius: 10,
            color: '#e2e8f0',
            fontSize: 12,
            boxShadow: '0 8px 24px -8px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
          }}
          labelStyle={{ color: '#cbd5e1', fontWeight: 600, marginBottom: 2 }}
          itemStyle={{ color: '#e2e8f0' }}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={64}>
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={CATEGORY_CHART_COLORS[entry.name] || '#8b5cf6'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function CategoryBreakdown({ categories }) {
  const entries = Object.entries(categories || {}).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((sum, [, c]) => sum + c, 0)

  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">No data yet.</p>
    )
  }

  return (
    <ul className="space-y-3">
      {entries.map(([name, count]) => {
        const pct = total ? Math.round((count / total) * 100) : 0
        const color = CATEGORY_CHART_COLORS[name] || '#8b5cf6'
        return (
          <li key={name} className="group">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 capitalize text-slate-300">
                <span
                  className="h-2.5 w-2.5 rounded-full transition-transform duration-300 group-hover:scale-125"
                  style={{ backgroundColor: color, boxShadow: `0 0 8px -1px ${color}` }}
                />
                {name}
              </span>
              <span className="tabular-nums text-slate-400">
                {count} · {pct}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function DependencyRow({ icon: Icon, label, value }) {
  const ok = value === 'ok'
  return (
    <div
      className={`group flex items-center justify-between rounded-lg border bg-surface-raised px-3 py-2.5 transition-all duration-300 hover:-translate-y-0.5 ${
        ok
          ? 'border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_0_18px_-4px_rgba(16,185,129,0.5)]'
          : 'border-red-500/20 hover:border-red-500/40 hover:shadow-[0_0_18px_-4px_rgba(239,68,68,0.5)]'
      }`}
    >
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <Icon
          className={`h-4 w-4 transition-colors duration-300 ${
            ok
              ? 'text-slate-500 group-hover:text-emerald-400'
              : 'text-slate-500 group-hover:text-red-400'
          }`}
        />
        {label}
      </div>
      <span
        className={`flex items-center gap-1.5 text-xs font-medium transition-colors duration-300 ${
          ok ? 'text-emerald-400' : 'text-red-400'
        }`}
        title={typeof value === 'string' ? value : ''}
      >
        <span className="relative flex h-1.5 w-1.5">
          {ok && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
          )}
          <span
            className={`relative inline-flex h-1.5 w-1.5 rounded-full transition-shadow duration-300 ${
              ok
                ? 'bg-emerald-400 shadow-[0_0_8px_1px_rgba(16,185,129,0.8)]'
                : 'bg-red-400 shadow-[0_0_8px_1px_rgba(239,68,68,0.8)]'
            }`}
          />
        </span>
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
      {/* Page intro + refresh control */}
      <div className="flex flex-col gap-4 animate-fade-in sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            <span className="text-gradient">Dashboard</span>
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Live overview · auto-refreshes every 10s
          </p>
        </div>
        <button
          onClick={load}
          className="btn-ghost group shrink-0"
          disabled={refreshing}
        >
          <RefreshCw
            className={`h-4 w-4 transition-transform duration-300 ${
              refreshing ? 'animate-spin' : 'group-hover:rotate-90'
            }`}
          />
          {refreshing ? 'Refreshing…' : 'Refresh'}
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
            <div className="animate-fade-in" style={{ animationDelay: '0ms' }}>
              <StatCard
                icon={Building2}
                label="Total Platforms"
                value={stats?.total_platforms ?? 0}
                accent="brand"
                loading={loading}
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '60ms' }}>
              <StatCard
                icon={FileCheck2}
                label="Moderation Results"
                value={stats?.total_moderation_results ?? 0}
                accent="sky"
                loading={loading}
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '120ms' }}>
              <StatCard
                icon={Gauge}
                label="Avg Confidence"
                value={avgPct}
                accent="emerald"
                loading={loading}
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '180ms' }}>
              <StatCard
                icon={ListOrdered}
                label="Queue Size"
                value={stats?.queue_size ?? 0}
                hint="pending in stream"
                accent="amber"
                loading={loading}
              />
            </div>
          </div>

          {/* Category chart + breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div
              className="card-interactive animate-fade-in p-5 lg:col-span-2"
              style={{ animationDelay: '220ms' }}
            >
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/15 text-brand-soft">
                  <BarChart3 className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Category Distribution
                  </h2>
                  <p className="text-xs text-slate-500">
                    Breakdown of moderated content by category
                  </p>
                </div>
              </div>
              {loading ? (
                <LoadingState label="Loading chart…" />
              ) : (
                <CategoryChart categories={stats?.categories} />
              )}
            </div>

            {/* Category breakdown list */}
            <div
              className="card-interactive animate-fade-in p-5"
              style={{ animationDelay: '280ms' }}
            >
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <PieChart className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Breakdown
                  </h2>
                  <p className="text-xs text-slate-500">Share by category</p>
                </div>
              </div>
              {loading ? (
                <LoadingState label="Loading…" />
              ) : (
                <CategoryBreakdown categories={stats?.categories} />
              )}
            </div>
          </div>

          {/* System Health — full-width strip */}
          <div
            className="card-interactive animate-fade-in p-5"
            style={{ animationDelay: '340ms' }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Activity className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    System Health
                  </h2>
                  <p className="text-xs text-slate-500">
                    Backend service dependencies
                  </p>
                </div>
              </div>
              {health && health.service && (
                <span className="hidden rounded-full bg-surface-raised px-3 py-1 text-xs text-slate-400 sm:inline">
                  {health.service}
                </span>
              )}
            </div>
            {health === false ? (
              <p className="rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                API gateway is unreachable.
              </p>
            ) : health === null ? (
              <p className="text-sm text-slate-500">Checking…</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DependencyRow icon={Server} label="Redis" value={deps.redis} />
                <DependencyRow
                  icon={Database}
                  label="Database"
                  value={deps.database}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
