import { Loader2, AlertTriangle, Inbox } from 'lucide-react'
import Loader from './Loader.jsx'

// ---- Category badge ---------------------------------------------------------

const CATEGORY_STYLES = {
  safe: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:shadow-[0_0_12px_-2px_rgba(16,185,129,0.5)]',
  'self-harm': 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:shadow-[0_0_12px_-2px_rgba(239,68,68,0.5)]',
  'hate-speech': 'border-orange-500/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 hover:shadow-[0_0_12px_-2px_rgba(249,115,22,0.5)]',
  'adult-content': 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:shadow-[0_0_12px_-2px_rgba(244,63,94,0.5)]',
  error: 'border-slate-500/40 bg-slate-500/10 text-slate-400 hover:bg-slate-500/20',
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
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize transition-all duration-200 ${style}`}
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
    <div className="group flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-700">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-slate-400 transition-colors group-hover:text-slate-200">
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
          className="rounded bg-slate-700/70 px-1.5 py-0.5 text-xs text-slate-300 transition-all duration-200 hover:bg-brand/20 hover:text-brand-soft"
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
    <div className="flex items-center justify-center py-12">
      <Loader size={52} label={label} />
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex animate-fade-in flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle className="h-6 w-6 text-red-400" />
      </div>
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
    <div className="flex animate-fade-in flex-col items-center justify-center gap-3 py-12 text-slate-500">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700/40">
        <Inbox className="h-6 w-6" />
      </div>
      <p className="text-sm">{message}</p>
    </div>
  )
}

export function Spinner({ className = 'h-4 w-4' }) {
  return <Loader2 className={`animate-spin ${className}`} />
}
