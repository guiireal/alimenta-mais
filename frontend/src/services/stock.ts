import { config } from '../config'
import type { DisposalReason, LotInput, LotQuery, Paged, StockLot, StockMovement, StockStats, Warehouse } from '../types'
import { daysUntil, getExpiryStatus, isPerishable, sortByFefo } from '../lib/utils'
import { ApiError, db, logAudit, logMovement, nextId, simulate } from './db'

const activeLots = (): StockLot[] => db.lots.filter((l) => l.status === 'active')

const matchesStatus = (lot: StockLot, status: NonNullable<LotQuery['status']>): boolean => {
  if (status === 'all') return true
  const current = getExpiryStatus(lot.expiresAt)
  return status === 'alert' ? current === 'expired' || current === 'critical' : current === status
}

function sortLots(lots: StockLot[], sort: NonNullable<LotQuery['sort']>, dir: NonNullable<LotQuery['dir']>): StockLot[] {
  const sorted =
    sort === 'expiresAt' ? sortByFefo(lots)
    : [...lots].sort((a, b) =>
        sort === 'item' ? a.item.localeCompare(b.item, 'pt-BR')
        : sort === 'quantity' ? a.quantity - b.quantity
        : a.id.localeCompare(b.id))
  return dir === 'desc' ? sorted.reverse() : sorted
}

export const listLots = (query: LotQuery = {}): Promise<Paged<StockLot>> =>
  simulate(() => {
    const { q = '', category = 'all', status = 'all', sort = 'expiresAt', dir = 'asc', page = 1, pageSize = config.pageSize } = query
    const needle = q.trim().toLowerCase()
    const filtered = activeLots().filter(
      (l) =>
        (category === 'all' || l.category === category) &&
        matchesStatus(l, status) &&
        (!needle || l.item.toLowerCase().includes(needle) || l.id.toLowerCase().includes(needle)),
    )
    const ordered = sortLots(filtered, sort, dir)
    const pages = Math.max(1, Math.ceil(ordered.length / pageSize))
    const current = Math.min(Math.max(1, page), pages)
    return { items: ordered.slice((current - 1) * pageSize, current * pageSize), total: ordered.length, page: current, pageSize }
  })

export const getStockStats = (): Promise<StockStats> =>
  simulate(() => {
    const lots = activeLots()
    const withDate = lots.filter((l) => l.expiresAt)
    const count = (s: string) => lots.filter((l) => getExpiryStatus(l.expiresAt) === s).length
    return {
      expired: count('expired'),
      critical: count('critical'),
      alerts: count('expired') + count('critical'),
      week: withDate.filter((l) => { const d = daysUntil(l.expiresAt as string); return d >= 0 && d <= 7 }).length,
      registeredPct: lots.length ? Math.round((withDate.length / lots.length) * 100) : 100,
    }
  })

export const getLot = (id: string): Promise<{ lot: StockLot; movements: StockMovement[] }> =>
  simulate(() => {
    const lot = db.lots.find((l) => l.id === id)
    if (!lot) throw new ApiError('Lote não encontrado.', 404)
    const movements = db.movements.filter((m) => m.lotId === id).sort((a, b) => b.at.localeCompare(a.at))
    return { lot, movements }
  })

function assertWarehouse(category: StockLot['category'], warehouse: Warehouse): void {
  if (isPerishable(category) && warehouse !== 'Câmara fria') throw new ApiError('Perecíveis devem ficar na câmara fria.', 422)
}

export const createLot = (input: LotInput): Promise<StockLot> =>
  simulate(() => {
    if (!input.item.trim() || input.quantity <= 0) throw new ApiError('Dados do lote inválidos.', 422)
    assertWarehouse(input.category, input.warehouse)
    const lot: StockLot = { ...input, item: input.item.trim(), id: nextId('L', db.lots.map((l) => l.id)), status: 'active' }
    db.lots.push(lot)
    logMovement(lot.id, 'entry', 'Entrada manual no estoque')
    logAudit('Entrada de lote', lot.id)
    return lot
  })

export const transferLot = (id: string, warehouse: Warehouse): Promise<StockLot> =>
  simulate(() => {
    const lot = db.lots.find((l) => l.id === id)
    if (!lot) throw new ApiError('Lote não encontrado.', 404)
    if (lot.status === 'disposed') throw new ApiError('Este lote já recebeu baixa.', 409)
    if (lot.warehouse === warehouse) throw new ApiError('O lote já está neste depósito.', 409)
    assertWarehouse(lot.category, warehouse)
    logMovement(id, 'transfer', `De ${lot.warehouse} para ${warehouse}`)
    lot.warehouse = warehouse
    logAudit('Lote remanejado', id)
    return lot
  })

export const disposeLot = (id: string, reason: DisposalReason): Promise<StockLot> =>
  simulate(() => {
    const lot = db.lots.find((l) => l.id === id)
    if (!lot) throw new ApiError('Lote não encontrado.', 404)
    if (lot.status === 'disposed') throw new ApiError('Este lote já recebeu baixa.', 409)
    lot.status = 'disposed'
    logMovement(id, 'disposal', `Baixa por: ${reason}`)
    logAudit('Baixa de lote', id)
    return lot
  })
