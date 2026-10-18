import { cn, daysLabel, daysUntil, EXPIRY_META, getExpiryStatus } from '../lib/utils'

const WINDOW_DAYS = 30

/** Barra de vida útil: quanto falta para vencer dentro de uma janela de 30 dias. */
export function ShelfLife({ expiresAt, className }: { expiresAt: string | null; className?: string }) {
  const status = getExpiryStatus(expiresAt)
  const days = expiresAt ? daysUntil(expiresAt) : 0
  const pct = status === 'expired' ? 100 : status === 'none' ? 0 : Math.min(100, Math.max(6, (days / WINDOW_DAYS) * 100))
  return (
    <div role="img" aria-label={daysLabel(expiresAt)} className={cn('h-2 w-full overflow-hidden rounded-full bg-cream-100', className)}>
      <div className={cn('h-full rounded-full', EXPIRY_META[status].bar)} style={{ width: `${pct}%` }} />
    </div>
  )
}
