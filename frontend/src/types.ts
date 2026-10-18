export type Tone = 'green' | 'orange' | 'red' | 'neutral'

/* ---------- estoque ---------- */
export type ExpiryStatus = 'expired' | 'critical' | 'warning' | 'ok' | 'none'
export type Category = string
export type Warehouse = string
export type LotStatus = 'active' | 'disposed'

export interface StockLot {
  id: string
  batchCode: string
  productId: string
  item: string
  category: Category
  quantity: number
  unit: string
  expiresAt: string | null
  warehouse: Warehouse
  status: LotStatus
  balances: { warehouseId: string; warehouseName: string; quantity: string }[]
}
export interface LotInput {
  productId: string
  batchCode: string
  quantity: string
  unitWeightKg: string
  expiresAt: string
  warehouse: Warehouse
}
export type MovementType = 'entry' | 'transfer' | 'expiration_loss' | 'other_loss' | 'distribution' | 'return' | 'adjustment_out'
export interface StockMovement {
  id: string
  lotId: string
  at: string
  type: MovementType
  user: string
  note: string
}
export type DisposalReason = 'Vencimento' | 'Avaria' | 'Contaminação' | 'Outro'

export type SortDir = 'asc' | 'desc'
export type LotSortKey = 'expiresAt' | 'item' | 'quantity' | 'id'
export type LotStatusFilter = ExpiryStatus | 'alert' | 'all'
export interface LotQuery {
  q?: string
  category?: Category | 'all'
  status?: LotStatusFilter
  sort?: LotSortKey
  dir?: SortDir
  page?: number
  pageSize?: number
}
export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
export interface StockStats {
  expired: number
  critical: number
  week: number
  registeredPct: number
  /** vencidos + críticos */
  alerts: number
}

/* ---------- doações e doadores ---------- */
export type DonorType = 'PF' | 'PJ'
export interface Donor {
  id: string
  name: string
  type: DonorType
  totalKg: number
  donationsCount: number
  lastDonationAt: string | null
  email?: string
  phone?: string
}
export interface DonorInput {
  name: string
  type: DonorType
  email: string
  phone: string
}
export type TriageStatus = 'approved' | 'review' | 'rejected'
export type DonationStage = 'draft' | 'received' | 'triage' | 'stored' | 'available'
export interface Donation {
  id: string
  donorId: string
  donorName: string
  donorType: DonorType
  receivedAt: string
  stage: DonationStage
  weightKg: number
  document?: string
}
export interface DonationItemInput extends LotInput {
  triage: TriageStatus
}
export interface DonationInput {
  donorId: string
  receivedAt: string
  document: string
  items: DonationItemInput[]
}

/* ---------- famílias e entregas ---------- */
export type ConsentStatus = 'granted' | 'pending'
export interface Family {
  id: string
  code: string
  neighborhood: string
  members: number
  consent: ConsentStatus
  lastDeliveryAt: string | null
  contactName: string
  address: string
  city: string
  state: string
  active: boolean
}
export interface FamilyInput {
  code: string
  contactName: string
  address: string
  neighborhood: string
  city: string
  state: string
  members: number
}
export type DeliveryStatus = 'delivered' | 'en_route' | 'waiting' | 'failed' | 'cancelled'
export interface RouteStop {
  id: string
  order: number
  destination: string
  familyId?: string
  items: string
  eta: string
  status: DeliveryStatus
}
export type RouteStatus = 'waiting' | 'in_transit' | 'completed' | 'cancelled'
export interface DeliveryRoute {
  id: string
  name: string
  driver: string
  warehouse: string
  warehouseId: string
  scheduledOn: string
  status: RouteStatus
  stops: RouteStop[]
}
export interface RouteInput {
  name: string
  warehouseId: string
  scheduledOn: string
  assignedTo: string
}

/* ---------- acesso ---------- */
export type Role = 'administrator' | 'manager' | 'operator'
export type Permission =
  | 'stock:read' | 'stock:write' | 'stock:dispose'
  | 'donation:read' | 'donation:write'
  | 'donor:read' | 'donor:write'
  | 'family:read' | 'family:write'
  | 'delivery:read' | 'delivery:write'
  | 'report:read'
  | 'access:read' | 'access:write'
export interface AppUser {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
}
export interface AuditEntry {
  id: string
  at: string
  user: string
  action: string
  entity: string
}

/* ---------- indicadores ---------- */
export interface MonthlyPoint { month: string; donated: number; distributed: number }
export interface LossByCategory { category: Category; kg: number }
export interface Kpis { donatedKg: number; turnover: number; avgDeliveryHours: number; coveragePct: number }
