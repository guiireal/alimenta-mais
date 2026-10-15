import type { Category, DeliveryStatus, ExpiryStatus, StockLot, Tone, Warehouse } from '../types'

export const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ')

const DAY_MS = 86_400_000
const startOfDay = (d: Date): Date => {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export const daysUntil = (iso: string): number =>
  Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(new Date()).getTime()) / DAY_MS)

/** Regra de negócio: até 3 dias é crítico, até 14 dias pede atenção. */
export const getExpiryStatus = (iso: string | null): ExpiryStatus => {
  if (!iso) return 'none'
  const days = daysUntil(iso)
  if (days < 0) return 'expired'
  if (days <= 3) return 'critical'
  if (days <= 14) return 'warning'
  return 'ok'
}

export const EXPIRY_META: Record<ExpiryStatus, { label: string; tone: Tone; bar: string }> = {
  expired: { label: 'Vencido', tone: 'red', bar: 'bg-tomato-600' },
  critical: { label: 'Crítico', tone: 'red', bar: 'bg-tomato-600' },
  warning: { label: 'Atenção', tone: 'orange', bar: 'bg-carrot-500' },
  ok: { label: 'Em dia', tone: 'green', bar: 'bg-leaf-600' },
  none: { label: 'Sem validade', tone: 'neutral', bar: 'bg-cream-300' },
}

export const DELIVERY_META: Record<DeliveryStatus, { label: string; tone: Tone; pin: string }> = {
  delivered: { label: 'Entregue', tone: 'green', pin: 'bg-leaf-600 text-white' },
  en_route: { label: 'Em rota', tone: 'orange', pin: 'bg-carrot-500 text-ink-900' },
  waiting: { label: 'Aguardando', tone: 'neutral', pin: 'bg-white text-ink-900 border-2 border-cream-500' },
}

export const daysLabel = (iso: string | null): string => {
  if (!iso) return 'sem validade registrada'
  const days = daysUntil(iso)
  const unit = (n: number) => (n === 1 ? 'dia' : 'dias')
  if (days < 0) return `vencido há ${-days} ${unit(-days)}`
  if (days === 0) return 'vence hoje'
  return `vence em ${days} ${unit(days)}`
}

export const formatDate = (iso: string): string => new Intl.DateTimeFormat('pt-BR').format(new Date(iso))
export const formatNumber = (n: number): string => new Intl.NumberFormat('pt-BR').format(n)

/** FEFO: primeiro que vence, primeiro que sai. Lotes sem validade vão para o fim. */
export const sortByFefo = (lots: StockLot[]): StockLot[] => {
  const time = (l: StockLot) => (l.expiresAt ? new Date(l.expiresAt).getTime() : Number.POSITIVE_INFINITY)
  return [...lots].sort((a, b) => {
    const ta = time(a)
    const tb = time(b)
    return ta === tb ? 0 : ta < tb ? -1 : 1
  })
}

/** Data de hoje no formato do <input type="date">, no fuso local. */
export const todayInput = (): string => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export const formatDateTime = (iso: string): string =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))

/** Aceita vírgula ou ponto como separador decimal. */
export const parseNumber = (value: string): number => Number(value.trim().replace(',', '.'))

export const onlyDigits = (value: string): string => value.replace(/\D/g, '')

/** Perecíveis vão para a câmara fria; o restante, para o depósito seco. */
export const defaultWarehouse = (category: Category): Warehouse =>
  category === 'Laticínios' || category === 'Hortifrúti' ? 'Câmara fria' : 'Seco A'

export const isPerishable = (category: Category): boolean => defaultWarehouse(category) === 'Câmara fria'

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Algo deu errado. Tente novamente.'
