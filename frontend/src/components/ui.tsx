import { useEffect, type ReactNode } from 'react'

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-slate-800/70 border border-slate-700/50 rounded-2xl p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          {title && <h3 className="text-base font-semibold text-slate-100">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400" role="status">
      <span className="h-4 w-4 rounded-full border-2 border-slate-600 border-t-emerald-400 animate-spin" />
      {label}
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  const msg = error instanceof Error ? error.message : String(error)
  return <p className="text-sm text-rose-400" role="alert">{msg}</p>
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-slate-800 border border-slate-700 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const inputCls =
  'w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500'

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition'

export const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition'

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-slate-300 mb-1">
        {label} {hint && <span className="text-slate-500 font-normal">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

/** 1..max picker rendered as a row of buttons; click the selected value again to clear. */
export function Scale({ value, onChange, max, label, required = false }: { value: number | null; onChange: (v: number | null) => void; max: number; label: string; required?: boolean }) {
  return (
    <div>
      <span className="block text-sm text-slate-300 mb-1">
        {label} <span className="text-slate-500">{value ? `${value}/${max}` : required ? 'required' : 'optional'}</span>
      </span>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            type="button"
            key={n}
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(value === n ? null : n)}
            className={`flex-1 h-9 rounded-md text-sm transition ${
              value !== null && n <= value ? 'bg-emerald-500 text-slate-950 font-semibold' : 'bg-slate-900 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
