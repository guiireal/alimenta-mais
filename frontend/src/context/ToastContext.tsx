import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../lib/utils'

type Kind = 'success' | 'error'
interface Toast { id: number; kind: Kind; message: string }
interface ToastApi { success: (message: string) => void; error: (message: string) => void }

const ToastContext = createContext<ToastApi | null>(null)
let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), [])
  const push = useCallback((kind: Kind, message: string) => {
    const id = ++counter
    setToasts((prev) => [...prev, { id, kind, message }])
    setTimeout(() => dismiss(id), 5000)
  }, [dismiss])
  const api = useMemo<ToastApi>(() => ({ success: (m) => push('success', m), error: (m) => push('error', m) }), [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="fixed inset-x-4 bottom-4 z-50 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-4 sm:w-96">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className={cn('flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm font-semibold shadow-lg', t.kind === 'error' ? 'bg-tomato-600 text-white' : 'bg-leaf-900 text-white')}>
            <span>{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Fechar aviso" className="rounded p-0.5 hover:bg-white/20"><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast precisa estar dentro de ToastProvider')
  return ctx
}
