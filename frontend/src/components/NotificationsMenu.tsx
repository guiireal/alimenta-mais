import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFamilies, useLots, useStockStats } from '../hooks/queries'
import { daysLabel, errorMessage } from '../lib/utils'
import { ExpiryBadge } from './ExpiryBadge'
import { ErrorState, Skeleton } from './ui'

/** Painel de notificações: mostra os alertas ali mesmo, sem tirar a pessoa da tela em que está. */
export function NotificationsMenu() {
  const { can } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const canStock = can('stock:read')
  const canFamilies = can('family:read')
  const stats = useStockStats(canStock)
  const lots = useLots({ status: 'alert', pageSize: 5 }, canStock && open)
  const pending = useFamilies({ consent: 'pending' }, canFamilies && open)

  const alerts = stats.data?.alerts ?? 0
  const pendingCount = pending.data?.length ?? 0

  // qualquer navegação fecha o painel
  useEffect(() => setOpen(false), [location.key])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus() }
    }
    window.document.addEventListener('mousedown', onDown)
    window.document.addEventListener('keydown', onKey)
    return () => {
      window.document.removeEventListener('mousedown', onDown)
      window.document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!canStock && !canFamilies) return null

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="painel-notificacoes"
        aria-label={`Notificações, ${alerts} ${alerts === 1 ? 'alerta' : 'alertas'} de validade`}
        className="relative rounded-lg p-2 hover:bg-cream-100"
      >
        <Bell size={20} aria-hidden="true" />
        {alerts > 0 && <span aria-hidden="true" className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-tomato-600 text-[10px] font-bold text-white">{alerts}</span>}
      </button>

      {open && (
        <div
          id="painel-notificacoes"
          role="region"
          aria-label="Notificações"
          className="fixed inset-x-3 top-16 z-30 max-h-[70dvh] overflow-y-auto rounded-xl border border-cream-200 bg-white p-4 shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <h2 className="text-base font-bold">Notificações</h2>

          {canStock && (
            <section className="mt-3" aria-label="Validade">
              <h3 className="text-sm font-bold text-ink-600">Lotes vencidos ou críticos</h3>
              {lots.isError ? <ErrorState message={errorMessage(lots.error)} onRetry={() => void lots.refetch()} /> : lots.isLoading ? <Skeleton className="mt-2 h-20" /> : lots.data && lots.data.items.length > 0 ? (
                <ul className="mt-2 divide-y divide-cream-100">
                  {lots.data.items.map((lot) => (
                    <li key={lot.id} className="flex items-start justify-between gap-2 py-2 text-sm">
                      <div>
                        <Link to={`/estoque/${lot.id}`} className="font-semibold hover:underline">{lot.item}</Link>
                        <p className="text-xs text-ink-600">Lote {lot.id}, {daysLabel(lot.expiresAt)}</p>
                      </div>
                      <ExpiryBadge expiresAt={lot.expiresAt} />
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-sm text-ink-600">Nenhum lote vencido ou crítico agora.</p>}
              <Link to="/estoque?status=alert" className="mt-2 inline-block text-sm font-bold text-leaf-700 hover:underline">Ver todos no estoque</Link>
            </section>
          )}

          {canFamilies && pending.isError && <ErrorState message={errorMessage(pending.error)} onRetry={() => void pending.refetch()} />}
          {canFamilies && pendingCount > 0 && (
            <section className="mt-4 border-t border-cream-100 pt-3" aria-label="Consentimentos">
              <Link to="/familias" className="text-sm font-semibold hover:underline">
                {pendingCount} {pendingCount === 1 ? 'família aguarda' : 'famílias aguardam'} consentimento LGPD
              </Link>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
