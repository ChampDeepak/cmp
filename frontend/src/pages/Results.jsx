import { useCallback, useState } from 'react'
import { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '../api.js'
import { useCachedResource } from '../lib/cache.js'
import {
  CategoryBadge,
  ConfidenceBar,
  KeywordChips,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../components/ui.jsx'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ReasonCell({ reason }) {
  const [open, setOpen] = useState(false)
  if (!reason) return <span className="text-xs text-slate-600">—</span>
  const isLong = reason.length > 80
  return (
    <button
      onClick={() => isLong && setOpen((o) => !o)}
      className={`flex items-start gap-1 text-left text-sm text-slate-300 ${isLong ? 'cursor-pointer hover:text-slate-100' : 'cursor-default'}`}
    >
      {isLong &&
        (open ? (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
        ) : (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
        ))}
      <span className={open ? '' : 'line-clamp-2'}>{reason}</span>
    </button>
  )
}

export default function Results() {
  const [filter, setFilter] = useState('')

  // Platforms for the filter dropdown (best-effort, cached).
  const { data: platformsData } = useCachedResource(
    'platforms',
    api.getPlatforms
  )
  const platforms = Array.isArray(platformsData) ? platformsData : []

  const fetchResults = useCallback(() => api.getResults(filter), [filter])
  const {
    data: resultsData,
    loading,
    error,
    refetch: loadResults,
  } = useCachedResource(`results:${filter}`, fetchResults)
  const results = Array.isArray(resultsData) ? resultsData : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select
            className="input w-56"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All platforms</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="text-sm text-slate-500">
            {results.length} result{results.length === 1 ? '' : 's'}
          </span>
        </div>
        <button
          onClick={loadResults}
          className="btn-ghost"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <LoadingState label="Loading results…" />
        ) : error ? (
          <ErrorState message={error} onRetry={loadResults} />
        ) : results.length === 0 ? (
          <EmptyState message="No moderation results found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Platform</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Confidence</th>
                  <th className="px-4 py-3 font-medium">Flagged Keywords</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {results.map((r) => (
                  <tr
                    key={r.request_id}
                    className="align-top transition-colors hover:bg-surface-raised/50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-200">
                      {r.platform_name}
                    </td>
                    <td className="px-4 py-3">
                      <CategoryBadge category={r.post_category} />
                    </td>
                    <td className="px-4 py-3">
                      <ConfidenceBar score={r.confidence_score} />
                    </td>
                    <td className="max-w-[200px] px-4 py-3">
                      <KeywordChips keywords={r.flagged_keywords} />
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <ReasonCell reason={r.reason} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                      {formatDate(r.completed_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
