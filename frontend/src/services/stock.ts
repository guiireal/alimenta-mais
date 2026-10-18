import { config } from '../config'
import type { DisposalReason, LotInput, LotQuery, Paged, StockLot, StockMovement, StockStats } from '../types'
import { allPages, http, type Page } from './http'

export interface InventoryDTO {
  id: number; product_id: number; batch_code: string; product_name: string; category_name: string; unit: string
  quantity: string; expires_on: string | null
  balances: { warehouse_id: number; warehouse_name: string; quantity: string }[]
}
export const lotFromAPI = (b: InventoryDTO): StockLot => ({
  id: String(b.id), batchCode: b.batch_code, productId: String(b.product_id), item: b.product_name, category: b.category_name,
  quantity: Number(b.quantity), unit: b.unit, expiresAt: b.expires_on,
  warehouse: b.balances.map((v) => v.warehouse_name).join(', ') || 'Sem saldo',
  status: Number(b.quantity) > 0 ? 'active' : 'disposed',
  balances: b.balances.map((v) => ({ warehouseId: String(v.warehouse_id), warehouseName: v.warehouse_name, quantity: v.quantity })),
})
const filters = (q: LotQuery) => ({
  q: q.q, category_id: q.category === 'all' ? undefined : q.category,
  status: q.status === 'all' ? undefined : q.status, sort: q.sort, dir: q.dir,
})
export async function listLots(query: LotQuery = {}): Promise<Paged<StockLot>> {
  const data = await http.get<Page<InventoryDTO>>('/inventory', { ...filters(query), page: query.page ?? 1, page_size: query.pageSize ?? config.pageSize })
  return { ...data, pageSize: data.page_size, items: data.items.map(lotFromAPI) }
}
export const exportLots = async (query: LotQuery) => ({ items: (await allPages<InventoryDTO>('/inventory', filters(query))).map(lotFromAPI) })
export async function getStockStats(): Promise<StockStats> {
  const data = await http.get<{ expired: number; critical: number; week: number; registered_pct: string }>('/stock/stats')
  return { ...data, alerts: data.expired + data.critical, registeredPct: Number(data.registered_pct) }
}
export interface MovementDTO { id: number; batch_id: number; moved_at: string; type: string; recorded_by: number; reason: string | null; quantity: string; from_warehouse_id: number | null; to_warehouse_id: number | null }
export async function getLot(id: string): Promise<{ lot: StockLot; movements: StockMovement[] }> {
  const [lot, movements] = await Promise.all([
    http.get<InventoryDTO>('/inventory/' + id), allPages<MovementDTO>('/batches/' + id + '/movements'),
  ])
  return { lot: lotFromAPI(lot), movements: movements.map((m) => ({
    id: String(m.id), lotId: String(m.batch_id), at: m.moved_at, type: m.type === 'receipt' || m.type === 'adjustment_in' ? 'entry' : m.type as StockMovement['type'],
    user: 'Usuário #' + m.recorded_by,
    note: [m.quantity + ' ' + lot.unit, m.from_warehouse_id ? 'Origem #' + m.from_warehouse_id : '', m.to_warehouse_id ? 'Destino #' + m.to_warehouse_id : '', m.reason].filter(Boolean).join(' · '),
  })) }
}
export const batchBody = (input: LotInput) => ({
  product_id: Number(input.productId), batch_code: input.batchCode, quantity: input.quantity.trim().replace(',', '.'),
  unit_weight_kg: input.unitWeightKg.trim().replace(',', '.'), expires_on: input.expiresAt || null, warehouse_id: Number(input.warehouse || 0),
})
export const createLot = async (input: LotInput): Promise<{ id: string }> => {
  const lot = await http.post<{ id: number }>('/batches', { ...batchBody(input), triage_status: 'approved' })
  return { id: String(lot.id) }
}
export interface TransferInput { id: string; fromWarehouse: string; warehouse: string; quantity: string }
export const transferLot = (input: TransferInput) => http.post('/batches/' + input.id + '/movements', {
  type: 'transfer', quantity: input.quantity.trim().replace(',', '.'), from_warehouse_id: Number(input.fromWarehouse), to_warehouse_id: Number(input.warehouse),
})
export interface DisposalInput { id: string; fromWarehouse: string; quantity: string; reason: DisposalReason }
export const disposeLot = (input: DisposalInput) => http.post('/batches/' + input.id + '/movements', {
  type: input.reason === 'Vencimento' ? 'expiration_loss' : 'other_loss', quantity: input.quantity.trim().replace(',', '.'),
  from_warehouse_id: Number(input.fromWarehouse), reason: input.reason,
})
