export default function StatCard({ icon: Icon, label, value, hint, accent = 'brand', loading }) {
  const accents = {
    brand: 'bg-brand/15 text-brand-soft',
    emerald: 'bg-emerald-500/15 text-emerald-400',
    amber: 'bg-amber-500/15 text-amber-400',
    sky: 'bg-sky-500/15 text-sky-400',
  }
  return (
    <div className="card flex items-center gap-4 p-5">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${accents[accent] || accents.brand}`}
      >
        {Icon && <Icon className="h-5 w-5" />}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        {loading ? (
          <div className="mt-1.5 h-7 w-16 animate-pulse rounded bg-slate-700" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums text-white">
            {value}
          </p>
        )}
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  )
}
