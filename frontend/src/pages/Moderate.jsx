import { useCallback, useEffect, useState } from 'react'
import { Send, CheckCircle2, Copy, ShieldCheck } from 'lucide-react'
import { api } from '../api.js'
import { useToast } from '../components/Toast.jsx'
import { Spinner } from '../components/ui.jsx'

const AGE_OPTIONS = [
  { value: 'below 18', label: 'Below 18' },
  { value: '18 and above', label: '18 and above' },
]

export default function Moderate() {
  const toast = useToast()
  const [platforms, setPlatforms] = useState([])
  const [platformsError, setPlatformsError] = useState(null)
  const [text, setText] = useState('')
  const [platformId, setPlatformId] = useState('')
  const [age, setAge] = useState('18 and above')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [errors, setErrors] = useState({})

  const loadPlatforms = useCallback(async () => {
    try {
      const data = await api.getPlatforms()
      setPlatforms(data)
      setPlatformsError(null)
    } catch (err) {
      setPlatformsError(err.message)
    }
  }, [])

  useEffect(() => {
    loadPlatforms()
  }, [loadPlatforms])

  const validate = () => {
    const next = {}
    if (!text.trim()) next.text = 'Content text is required.'
    if (!platformId) next.platformId = 'Please select a platform.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setResult(null)
    try {
      const res = await api.moderate({ text, platformId, age })
      setResult(res)
      toast.success(`Queued for moderation · queue size ${res.queue_size}`)
      setText('')
      setErrors({})
    } catch (err) {
      toast.error(err.message || 'Failed to submit for moderation.')
    } finally {
      setSubmitting(false)
    }
  }

  const copyRequestId = () => {
    if (result?.request_id) {
      navigator.clipboard?.writeText(result.request_id)
      toast.info('Request ID copied')
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Form */}
      <div className="card p-6 lg:col-span-3">
        <div className="mb-5 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-brand-soft" />
          <h2 className="text-base font-semibold text-white">
            Submit Content for Moderation
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label" htmlFor="text">
              Content Text
            </label>
            <textarea
              id="text"
              rows={6}
              className={`input resize-y ${errors.text ? 'border-red-500 ring-1 ring-red-500' : ''}`}
              placeholder="Paste the post or comment to moderate…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {errors.text && (
              <p className="mt-1 text-xs text-red-400">{errors.text}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="platform">
                Platform
              </label>
              <select
                id="platform"
                className={`input ${errors.platformId ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                value={platformId}
                onChange={(e) => setPlatformId(e.target.value)}
              >
                <option value="">Select a platform…</option>
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {errors.platformId && (
                <p className="mt-1 text-xs text-red-400">{errors.platformId}</p>
              )}
              {platformsError && (
                <p className="mt-1 text-xs text-amber-400">
                  Could not load platforms: {platformsError}
                </p>
              )}
              {!platformsError && platforms.length === 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  No platforms registered yet.
                </p>
              )}
            </div>

            <div>
              <span className="label">Audience Age</span>
              <div className="flex gap-2">
                {AGE_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setAge(opt.value)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      age === opt.value
                        ? 'border-brand bg-brand/15 text-brand-soft'
                        : 'border-surface-border bg-surface-raised text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? <Spinner /> : <Send className="h-4 w-4" />}
              {submitting ? 'Submitting…' : 'Submit for Moderation'}
            </button>
          </div>
        </form>
      </div>

      {/* Result / info panel */}
      <div className="lg:col-span-2">
        {result ? (
          <div className="card animate-fade-in p-6">
            <div className="mb-4 flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Request Queued</h3>
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Request ID
                </dt>
                <dd className="mt-1 flex items-center gap-2">
                  <code className="break-all rounded bg-surface-raised px-2 py-1 text-xs text-slate-200">
                    {result.request_id}
                  </code>
                  <button
                    onClick={copyRequestId}
                    className="shrink-0 text-slate-500 hover:text-slate-200"
                    title="Copy"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </dd>
              </div>
              <div className="flex justify-between rounded-lg bg-surface-raised px-3 py-2">
                <dt className="text-slate-400">Queue</dt>
                <dd className="font-mono text-slate-200">{result.queue_name}</dd>
              </div>
              <div className="flex justify-between rounded-lg bg-surface-raised px-3 py-2">
                <dt className="text-slate-400">Queue Size</dt>
                <dd className="font-semibold text-slate-200">
                  {result.queue_size}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-slate-500">
              The worker will analyze this asynchronously. Check the Results tab
              once processing completes.
            </p>
          </div>
        ) : (
          <div className="card flex h-full flex-col justify-center gap-3 p-6 text-sm text-slate-400">
            <ShieldCheck className="h-8 w-8 text-slate-600" />
            <p>
              Submitted content is pushed onto the moderation queue and analyzed
              by the AI worker.
            </p>
            <p className="text-xs text-slate-500">
              The age selector influences strictness — content for under-18
              audiences is moderated more conservatively.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
