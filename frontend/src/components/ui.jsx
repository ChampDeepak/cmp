import { Loader2, AlertTriangle, Inbox } from 'lucide-react'

// ---- Category badge ---------------------------------------------------------

const CATEGORY_STYLES = {
  safe: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  'self-harm': 'border-red-500/40 bg-red-500/10 text-red-300',
  'hate-speech': 'border-orange-500/40 bg-orange-500/10 text-orange-300',
  'adult-content': 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  error: 'border-slate-500/40 bg-slate-500/10 text-slate-400',
}

export const CATEGORY_CHART_COLORS = {
  safe: '#10b981',
  'self-harm': '#ef4444',
  'hate-speech': '#f97316',
  'adult-content': '#f43f5e',
  error: '#64748b',
}

export function CategoryBadge({ category }) {
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.error
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}
    >
      {category || 'unknown'}
    </span>
  )
}

// ---- Confidence bar ---------------------------------------------------------

export function ConfidenceBar({ score }) {
  const value = typeof score === 'number' ? Math.max(0, Math.min(1, score)) : 0
  const pct = Math.round(value * 100)
  // Higher confidence -> greener; lower -> amber/red.
  const color =
    value >= 0.7
      ? 'bg-emerald-500'
      : value >= 0.4
        ? 'bg-amber-500'
        : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-700">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-slate-400">
        {pct}%
      </span>
    </div>
  )
}

// ---- Keyword chips ----------------------------------------------------------

export function KeywordChips({ keywords }) {
  if (!keywords || keywords.length === 0) {
    return <span className="text-xs text-slate-600">—</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {keywords.map((kw, i) => (
        <span
          key={`${kw}-${i}`}
          className="rounded bg-slate-700/70 px-1.5 py-0.5 text-xs text-slate-300"
        >
          {kw}
        </span>
      ))}
    </div>
  )
}

// ---- State helpers ----------------------------------------------------------

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin text-brand-soft" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <AlertTriangle className="h-7 w-7 text-red-400" />
      <p className="max-w-md text-sm text-slate-400">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost mt-1">
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message = 'Nothing here yet.' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
      <Inbox className="h-7 w-7" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

export function Spinner({ className = 'h-4 w-4' }) {
  return <Loader2 className={`animate-spin ${className}`} />
}
