export default function StatCard({ icon: Icon, label, value, hint, accent = 'brand', loading }) {
  const accents = {
    brand: 'bg-brand/15 text-brand-soft group-hover:bg-brand/25',
    emerald: 'bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500/25',
    amber: 'bg-amber-500/15 text-amber-400 group-hover:bg-amber-500/25',
    sky: 'bg-sky-500/15 text-sky-400 group-hover:bg-sky-500/25',
  }
  return (
    <div className="card-interactive group relative flex items-center gap-4 overflow-hidden p-5">
      {/* sheen that sweeps across on hover */}
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent transition-transform duration-700 group-hover:translate-x-full" />

      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-110 ${accents[accent] || accents.brand}`}
      >
        {Icon && <Icon className="h-5 w-5" />}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        {loading ? (
          <div className="skeleton mt-1.5 h-7 w-16" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums text-white transition-colors group-hover:text-gradient">
            {value}
          </p>
        )}
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  )
}
