import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ShieldCheck, ListChecks, Building2 } from 'lucide-react'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/moderate', label: 'Moderate', icon: ShieldCheck },
  { to: '/results', label: 'Results', icon: ListChecks },
  { to: '/platforms', label: 'Platforms', icon: Building2 },
]

export default function Sidebar() {
  return (
    <aside className="flex w-16 shrink-0 flex-col border-r border-surface-border bg-surface-card md:w-60">
      <div className="flex h-16 items-center gap-2.5 border-b border-surface-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand-soft">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="hidden md:block">
          <p className="text-sm font-semibold leading-tight text-white">
            ModGuard
          </p>
          <p className="text-xs leading-tight text-slate-500">
            Content Moderation
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {NAV.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand/15 text-brand-soft'
                    : 'text-slate-400 hover:bg-surface-raised hover:text-slate-200'
                }`
              }
              title={item.label}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden md:inline">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="hidden border-t border-surface-border p-4 md:block">
        <p className="text-xs text-slate-600">Admin Console</p>
      </div>
    </aside>
  )
}
