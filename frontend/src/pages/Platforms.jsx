import { useState } from 'react'
import { Building2, Plus, RefreshCw, Mail } from 'lucide-react'
import { api } from '../api.js'
import { useToast } from '../components/Toast.jsx'
import { EmptyState, ErrorState, LoadingState, Spinner } from '../components/ui.jsx'
import { useCachedResource } from '../lib/cache.js'

export default function Platforms() {
  const toast = useToast()
  const {
    data: platformsData,
    loading,
    error,
    refetch: load,
  } = useCachedResource('platforms', api.getPlatforms)
  const platforms = Array.isArray(platformsData) ? platformsData : []

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState({})

  const validate = () => {
    const next = {}
    if (!name.trim()) next.name = 'Name is required.'
    if (!email.trim()) next.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = 'Enter a valid email address.'
    setFormErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await api.registerPlatform(name.trim(), email.trim())
      toast.success(res.message || `Platform "${name}" registered.`)
      setName('')
      setEmail('')
      setFormErrors({})
      load()
    } catch (err) {
      if (err.status === 409) {
        toast.error(`Platform "${name}" already exists.`)
        setFormErrors({ name: 'This platform name already exists.' })
      } else {
        toast.error(err.message || 'Failed to register platform.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid animate-fade-in grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Table */}
      <div className="lg:col-span-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            <span className="text-gradient">Registered Platforms</span>
          </h2>
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <LoadingState label="Loading platforms…" />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : platforms.length === 0 ? (
            <EmptyState message="No platforms registered yet." />
          ) : (
            <div className="animate-fade-in overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-surface-raised/40 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {platforms.map((p) => (
                    <tr
                      key={p.id}
                      className="group transition-colors duration-200 hover:bg-surface-raised/60"
                    >
                      <td className="border-l-2 border-transparent px-4 py-3 font-mono text-xs text-slate-500 transition-colors duration-200 group-hover:border-brand group-hover:text-slate-300">
                        #{p.id}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-200 transition-colors duration-200 group-hover:text-white">
                        <span className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-500 transition-colors duration-200 group-hover:text-brand-soft" />
                          {p.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        <span className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-slate-600 transition-colors duration-200 group-hover:text-slate-400" />
                          {p.email}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Register form */}
      <div className="lg:col-span-2">
        <div className="card animate-scale-in p-6">
          <div className="mb-5 flex items-center gap-2">
            <Plus className="h-5 w-5 text-brand-soft" />
            <h2 className="text-base font-semibold">
              <span className="text-gradient">Register Platform</span>
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="pname">
                Platform Name
              </label>
              <input
                id="pname"
                type="text"
                className={`input ${formErrors.name ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                placeholder="e.g. forKids"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {formErrors.name && (
                <p className="mt-1 text-xs text-red-400">{formErrors.name}</p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="pemail">
                Contact Email
              </label>
              <input
                id="pemail"
                type="email"
                className={`input ${formErrors.email ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {formErrors.email && (
                <p className="mt-1 text-xs text-red-400">{formErrors.email}</p>
              )}
            </div>
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={submitting}
            >
              {submitting ? <Spinner /> : <Plus className="h-4 w-4" />}
              {submitting ? 'Registering…' : 'Register Platform'}
            </button>
            <p className="text-xs text-slate-500">
              Tip: a platform named <code className="text-slate-400">forKids</code>{' '}
              receives stricter moderation.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
