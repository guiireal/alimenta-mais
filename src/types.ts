export type Tone = 'green' | 'orange' | 'red' | 'neutral'

/* ---------- estoque ---------- */
export type ExpiryStatus = 'expired' | 'critical' | 'warning' | 'ok' | 'none'
export type Category = 'Laticínios' | 'Panificados' | 'Grãos' | 'Massas' | 'Óleos' | 'Hortifrúti'
export type Warehouse = 'Câmara fria' | 'Seco A' | 'Seco B'
export type LotStatus = 'active' | 'disposed'

export interface StockLot {
  id: string
  item: string
  category: Category
  quantity: number
  unit: 'un' | 'kg'
  expiresAt: string | null
  warehouse: Warehouse
  status: LotStatus
}
export interface LotInput {
  item: string
  category: Category
  quantity: number
  unit: 'un' | 'kg'
  expiresAt: string | null
  warehouse: Warehouse
}
export type MovementType = 'entry' | 'transfer' | 'disposal'
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
export type DonationStage = 'received' | 'triage' | 'stored' | 'available'
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
export interface DonationItemInput {
  name: string
  category: Category
  quantity: number
  expiresAt: string | null
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
}
export interface FamilyInput {
  neighborhood: string
  members: number
  consent: boolean
}
export type DeliveryStatus = 'delivered' | 'en_route' | 'waiting'
export interface RouteStop {
  id: string
  order: number
  destination: string
  familyId?: string
  items: string
  eta: string
  status: DeliveryStatus
  /** posição no mapa ilustrativo, em % */
  x: number
  y: number
}
export interface DeliveryRoute {
  id: string
  name: string
  driver: string
  vehicle: string
  depot: { x: number; y: number }
  stops: RouteStop[]
}
export interface RouteInput {
  name: string
  vehicle: string
  driver: string
  startTime: string
  familyIds: string[]
}

/* ---------- acesso ---------- */
export type Role = 'manager' | 'logistics' | 'volunteer' | 'auditor'
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
