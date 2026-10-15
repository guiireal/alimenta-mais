import type {
  AppUser, AuditEntry, DeliveryRoute, Donation, Donor, Family, Kpis, LossByCategory, MonthlyPoint, StockLot,
} from '../types'

/** Datas relativas a hoje, para os status de validade fazerem sentido a qualquer momento. */
const daysFromNow = (n: number): string => {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

export const kpis: Kpis = { donatedKg: 6240, turnover: 3.4, avgDeliveryHours: 4.2, coveragePct: 78 }

export const monthly: MonthlyPoint[] = [
  { month: 'Mai', donated: 4200, distributed: 3600 },
  { month: 'Jun', donated: 5100, distributed: 4300 },
  { month: 'Jul', donated: 4700, distributed: 4400 },
  { month: 'Ago', donated: 5800, distributed: 5000 },
  { month: 'Set', donated: 5400, distributed: 5200 },
  { month: 'Out', donated: 6240, distributed: 5100 },
]

export const lossByCategory: LossByCategory[] = [
  { category: 'Hortifrúti', kg: 180 },
  { category: 'Laticínios', kg: 120 },
  { category: 'Panificados', kg: 75 },
  { category: 'Grãos', kg: 30 },
  { category: 'Massas', kg: 12 },
]

export const stockLots: StockLot[] = [
  { id: 'L-0001', item: 'Leite integral 1 L', category: 'Laticínios', quantity: 120, unit: 'un', expiresAt: daysFromNow(2), warehouse: 'Câmara fria', status: 'active' },
  { id: 'L-0002', item: 'Pão de forma', category: 'Panificados', quantity: 80, unit: 'un', expiresAt: daysFromNow(3), warehouse: 'Seco A', status: 'active' },
  { id: 'L-0003', item: 'Iogurte natural 170 g', category: 'Laticínios', quantity: 60, unit: 'un', expiresAt: daysFromNow(-1), warehouse: 'Câmara fria', status: 'active' },
  { id: 'L-0004', item: 'Feijão carioca 1 kg', category: 'Grãos', quantity: 300, unit: 'un', expiresAt: daysFromNow(12), warehouse: 'Seco B', status: 'active' },
  { id: 'L-0005', item: 'Macarrão espaguete 500 g', category: 'Massas', quantity: 240, unit: 'un', expiresAt: daysFromNow(20), warehouse: 'Seco B', status: 'active' },
  { id: 'L-0006', item: 'Arroz tipo 1 5 kg', category: 'Grãos', quantity: 150, unit: 'un', expiresAt: daysFromNow(180), warehouse: 'Seco A', status: 'active' },
  { id: 'L-0007', item: 'Óleo de soja 900 ml', category: 'Óleos', quantity: 90, unit: 'un', expiresAt: daysFromNow(95), warehouse: 'Seco A', status: 'active' },
  { id: 'L-0008', item: 'Banana prata', category: 'Hortifrúti', quantity: 45, unit: 'kg', expiresAt: daysFromNow(4), warehouse: 'Câmara fria', status: 'active' },
  { id: 'L-0009', item: 'Fubá 1 kg', category: 'Grãos', quantity: 70, unit: 'un', expiresAt: null, warehouse: 'Seco B', status: 'active' },
]

export const donors: Donor[] = [
  { id: 'DN-01', name: 'Mercado Bom Prato', type: 'PJ', totalKg: 2140, donationsCount: 18, lastDonationAt: daysFromNow(-1) },
  { id: 'DN-02', name: 'Padaria Pão Dourado', type: 'PJ', totalKg: 620, donationsCount: 31, lastDonationAt: daysFromNow(-2) },
  { id: 'DN-03', name: 'Atacado Vila Verde', type: 'PJ', totalKg: 3380, donationsCount: 12, lastDonationAt: daysFromNow(-6) },
  { id: 'DN-04', name: 'Hortifruti São João', type: 'PJ', totalKg: 940, donationsCount: 22, lastDonationAt: daysFromNow(-3) },
  { id: 'DN-05', name: 'Doador PF 0001', type: 'PF', totalKg: 85, donationsCount: 4, lastDonationAt: daysFromNow(-9) },
  { id: 'DN-06', name: 'Doador PF 0002', type: 'PF', totalKg: 40, donationsCount: 2, lastDonationAt: daysFromNow(-15) },
]

export const donations: Donation[] = [
  { id: 'D-0101', donorId: 'DN-01', donorName: 'Mercado Bom Prato', donorType: 'PJ', receivedAt: daysFromNow(-1), stage: 'available', weightKg: 320 },
  { id: 'D-0102', donorId: 'DN-02', donorName: 'Padaria Pão Dourado', donorType: 'PJ', receivedAt: daysFromNow(-2), stage: 'stored', weightKg: 48 },
  { id: 'D-0103', donorId: 'DN-04', donorName: 'Hortifruti São João', donorType: 'PJ', receivedAt: daysFromNow(-3), stage: 'triage', weightKg: 160 },
  { id: 'D-0104', donorId: 'DN-03', donorName: 'Atacado Vila Verde', donorType: 'PJ', receivedAt: daysFromNow(-6), stage: 'available', weightKg: 900 },
  { id: 'D-0105', donorId: 'DN-05', donorName: 'Doador PF 0001', donorType: 'PF', receivedAt: daysFromNow(-9), stage: 'available', weightKg: 20 },
  { id: 'D-0106', donorId: 'DN-01', donorName: 'Mercado Bom Prato', donorType: 'PJ', receivedAt: daysFromNow(-12), stage: 'available', weightKg: 410 },
]

export const families: Family[] = [
  { id: 'f1', code: 'F-0001', neighborhood: 'Jardim das Flores', members: 4, consent: 'granted', lastDeliveryAt: daysFromNow(-3) },
  { id: 'f2', code: 'F-0002', neighborhood: 'Vila Nova', members: 3, consent: 'granted', lastDeliveryAt: daysFromNow(-3) },
  { id: 'f3', code: 'F-0003', neighborhood: 'Parque Esperança', members: 5, consent: 'pending', lastDeliveryAt: null },
  { id: 'f4', code: 'F-0004', neighborhood: 'Centro', members: 2, consent: 'granted', lastDeliveryAt: daysFromNow(-10) },
  { id: 'f5', code: 'F-0005', neighborhood: 'Jardim Horizonte', members: 6, consent: 'granted', lastDeliveryAt: daysFromNow(-10) },
  { id: 'f6', code: 'F-0006', neighborhood: 'Vila Nova', members: 4, consent: 'pending', lastDeliveryAt: null },
  { id: 'f7', code: 'F-0007', neighborhood: 'Parque Esperança', members: 3, consent: 'granted', lastDeliveryAt: daysFromNow(-17) },
]

export const routes: DeliveryRoute[] = [
  {
    id: 'R-01', name: 'Rota 01, zona sul', driver: 'Equipe A', vehicle: 'Van 01', depot: { x: 12, y: 72 },
    stops: [
      { id: 'S-101', order: 1, destination: 'Família F-0001', familyId: 'f1', items: 'Cesta básica', eta: '09:30', status: 'delivered', x: 30, y: 40 },
      { id: 'S-102', order: 2, destination: 'Família F-0002', familyId: 'f2', items: 'Cesta básica', eta: '10:10', status: 'en_route', x: 55, y: 62 },
      { id: 'S-103', order: 3, destination: 'Entidade Casa Acolher', items: 'Perecíveis', eta: '10:50', status: 'waiting', x: 78, y: 32 },
      { id: 'S-104', order: 4, destination: 'Família F-0005', familyId: 'f5', items: 'Cesta básica', eta: '11:30', status: 'waiting', x: 88, y: 66 },
    ],
  },
  {
    id: 'R-02', name: 'Rota 02, centro', driver: 'Equipe B', vehicle: 'Van 02', depot: { x: 10, y: 28 },
    stops: [
      { id: 'S-201', order: 1, destination: 'Família F-0004', familyId: 'f4', items: 'Cesta básica', eta: '09:00', status: 'delivered', x: 34, y: 54 },
      { id: 'S-202', order: 2, destination: 'Cozinha comunitária Centro', items: 'Hortifrúti', eta: '09:45', status: 'delivered', x: 58, y: 28 },
      { id: 'S-203', order: 3, destination: 'Família F-0007', familyId: 'f7', items: 'Cesta básica', eta: '10:30', status: 'en_route', x: 82, y: 58 },
    ],
  },
]

export const users: AppUser[] = [
  { id: 'U-1', name: 'Ana Souza', email: 'ana@alimenta.example', role: 'manager', active: true },
  { id: 'U-2', name: 'Carlos Lima', email: 'carlos@alimenta.example', role: 'logistics', active: true },
  { id: 'U-3', name: 'Bruna Reis', email: 'bruna@alimenta.example', role: 'volunteer', active: true },
  { id: 'U-4', name: 'Diego Costa', email: 'diego@alimenta.example', role: 'volunteer', active: false },
  { id: 'U-5', name: 'Elisa Prado', email: 'elisa@alimenta.example', role: 'auditor', active: true },
]

export const auditLog: AuditEntry[] = [
  { id: 'A-1', at: daysFromNow(0), user: 'Carlos Lima', action: 'Rota gerada', entity: 'R-01' },
  { id: 'A-2', at: daysFromNow(0), user: 'Bruna Reis', action: 'Entrada de lote', entity: 'L-0008' },
  { id: 'A-3', at: daysFromNow(-1), user: 'Ana Souza', action: 'Baixa por vencimento', entity: 'L-0003' },
  { id: 'A-4', at: daysFromNow(-1), user: 'Ana Souza', action: 'Consentimento LGPD registrado', entity: 'F-0007' },
  { id: 'A-5', at: daysFromNow(-2), user: 'Ana Souza', action: 'Perfil de acesso alterado', entity: 'U-4' },
  { id: 'A-6', at: daysFromNow(-3), user: 'Elisa Prado', action: 'Relatório exportado', entity: 'Doações por mês' },
]

/** Senha dos usuários de demonstração. Só existe no mock: com backend real, a autenticação é do servidor. */
export const DEMO_PASSWORD = 'alimenta123'
