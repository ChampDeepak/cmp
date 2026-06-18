import { ShieldCheck } from 'lucide-react'

/**
 * Brand loader: the ModGuard shield with two half-rings rotating around it in
 * opposite directions, plus a soft pulsing glow. Used everywhere we load data.
 *
 * Props:
 *   size  – diameter in px (default 56)
 *   label – optional caption shown beneath
 *   className – wrapper extras
 */
export default function Loader({ size = 56, label, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Pulsing glow behind the logo */}
        <span className="absolute inset-1 rounded-full bg-brand/30 blur-md animate-pulse-glow" />

        {/* Outer half-ring — clockwise */}
        <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand border-r-brand/30 animate-spin-slow" />

        {/* Inner half-ring — counter-clockwise */}
        <span className="absolute inset-[7px] rounded-full border-2 border-transparent border-b-brand-soft border-l-brand-soft/30 animate-spin-reverse" />

        {/* Shield logo in the centre */}
        <span className="absolute inset-0 flex items-center justify-center">
          <ShieldCheck
            className="text-brand-soft drop-shadow-[0_0_8px_rgba(129,140,248,0.7)]"
            style={{ width: size * 0.42, height: size * 0.42 }}
          />
        </span>
      </div>

      {label && (
        <p className="animate-pulse text-sm font-medium text-slate-400">{label}</p>
      )}
    </div>
  )
}

/** Full-area overlay loader (e.g. first app load / route boot). */
export function LoaderOverlay({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <Loader size={72} label={label} />
    </div>
  )
}
