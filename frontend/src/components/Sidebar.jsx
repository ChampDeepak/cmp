import { useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ShieldCheck, ListChecks, Building2 } from 'lucide-react'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/moderate', label: 'Moderate', icon: ShieldCheck },
  { to: '/results', label: 'Results', icon: ListChecks },
  { to: '/platforms', label: 'Platforms', icon: Building2 },
]

export default function Sidebar() {
  const [expanded, setExpanded] = useState(false)
  const timer = useRef(null)

  // Small delay before expanding so the rail doesn't pop open on accidental
  // pass-overs — and so the icon tooltips stay visible on a quick hover.
  const open = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setExpanded(true), 180)
  }
  const close = () => {
    clearTimeout(timer.current)
    setExpanded(false)
  }

  // Helper for the label text that slides open with the rail.
  const labelCls = `overflow-hidden whitespace-nowrap transition-all duration-300 ${
    expanded ? 'ml-3 max-w-[160px] opacity-100' : 'ml-0 max-w-0 opacity-0'
  }`

  return (
    // The <aside> reserves a fixed rail width in the layout; the inner panel is
    // absolutely positioned so expanding it OVERLAYS the content instead of
    // pushing it around.
    <aside
      onMouseEnter={open}
      onMouseLeave={close}
      className="relative z-30 w-[4.5rem] shrink-0"
    >
      <div
        className={`absolute inset-y-0 left-0 flex flex-col border-r border-surface-border bg-surface-card/95 backdrop-blur transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          expanded ? 'w-60 shadow-raised' : 'w-[4.5rem]'
        }`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center px-4">
          <div className="group flex h-9 w-9 shrink-0 animate-float items-center justify-center rounded-lg bg-brand-gradient text-white shadow-glow transition-transform duration-300 hover:scale-110 hover:shadow-glow-lg">
            <ShieldCheck className="h-5 w-5 transition-transform duration-300 group-hover:rotate-[8deg]" />
          </div>
          <div className={labelCls}>
            <p className="text-sm font-semibold leading-tight text-gradient">
              ModGuard
            </p>
            <p className="text-xs leading-tight text-slate-500">
              Content Moderation
            </p>
          </div>
        </div>
        <div className="mx-3 border-b border-surface-border/70" />

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-1 p-2.5">
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `group/item relative flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? 'bg-brand/15 text-brand-soft shadow-glow'
                      : 'text-slate-400 hover:bg-surface-raised hover:text-slate-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active left-accent bar */}
                    <span
                      className={`absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full bg-brand-gradient transition-all duration-300 ${
                        isActive ? 'h-5 w-1 opacity-100' : 'h-0 w-0 opacity-0'
                      }`}
                    />

                    <Icon
                      className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
                        isActive
                          ? 'scale-110 text-brand-soft'
                          : 'group-hover/item:scale-110 group-hover/item:text-brand-soft'
                      }`}
                    />

                    {/* Label — slides in when the rail expands */}
                    <span className={labelCls}>{item.label}</span>

                    {/* Tooltip — only while collapsed; escapes the rail to the right */}
                    {!expanded && (
                      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 origin-left scale-90 whitespace-nowrap rounded-md border border-surface-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-slate-100 opacity-0 shadow-raised transition-all duration-150 group-hover/item:scale-100 group-hover/item:opacity-100">
                        {item.label}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-surface-border p-4">
          <p
            className={`overflow-hidden whitespace-nowrap text-xs text-slate-600 transition-all duration-300 ${
              expanded ? 'max-w-[160px] opacity-100' : 'max-w-0 opacity-0'
            }`}
          >
            Admin Console
          </p>
        </div>
      </div>
    </aside>
  )
}
