import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

let idCounter = 0

const STYLES = {
  success: {
    icon: CheckCircle2,
    accent: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-[0_8px_30px_-8px_rgba(16,185,129,0.5)]',
    iconColor: 'text-emerald-400',
    bar: 'bg-emerald-400',
  },
  error: {
    icon: XCircle,
    accent: 'border-red-500/40 bg-red-500/10 text-red-300 shadow-[0_8px_30px_-8px_rgba(239,68,68,0.5)]',
    iconColor: 'text-red-400',
    bar: 'bg-red-400',
  },
  info: {
    icon: Info,
    accent: 'border-brand/40 bg-brand/10 text-brand-soft shadow-[0_8px_30px_-8px_rgba(99,102,241,0.5)]',
    iconColor: 'text-brand-soft',
    bar: 'bg-brand',
  },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (type, message, ttl = 4500) => {
      const id = ++idCounter
      setToasts((t) => [...t, { id, type, message }])
      if (ttl) {
        setTimeout(() => dismiss(id), ttl)
      }
      return id
    },
    [dismiss]
  )

  const toast = {
    success: (msg) => push('success', msg),
    error: (msg) => push('error', msg),
    info: (msg) => push('info', msg),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => {
          const style = STYLES[t.type] || STYLES.info
          const Icon = style.icon
          return (
            <div
              key={t.id}
              className={`pointer-events-auto relative flex animate-slide-in items-start gap-3 overflow-hidden rounded-xl border px-4 py-3 pl-5 shadow-raised backdrop-blur-md ${style.accent}`}
            >
              <span
                className={`absolute inset-y-0 left-0 w-1 ${style.bar}`}
                aria-hidden="true"
              />
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconColor}`} />
              <p className="flex-1 text-sm leading-snug">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="-mr-1 shrink-0 rounded-md p-0.5 text-current/70 transition-all duration-200 hover:bg-white/10 hover:text-current hover:opacity-100 active:scale-90"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
