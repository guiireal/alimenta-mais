import type { Kpis, LossByCategory, MonthlyPoint, StockLot } from '../types'
import { http } from './http'
import { listLots } from './stock'
import { listRoutes } from './deliveries'
export interface DashboardData { kpis: Kpis; monthly: MonthlyPoint[]; loss: LossByCategory[]; expiring: StockLot[]; routes: { id: string; name: string; done: number; total: number }[] }
export interface ReportData { monthly: MonthlyPoint[]; loss: LossByCategory[]; donatedKg: number; distributedKg: number; lossKg: number; coveragePct: number }
interface ReportDTO { donated_kg: string; distributed_kg: string; loss_kg: string; turnover: string; average_delivery_hours: string; coverage_pct: string; monthly: { month: string; donated_kg: string; distributed_kg: string }[]; loss_by_category: { category: string; kg: string }[] }
const reportFromAPI = (r: ReportDTO): ReportData => ({
  monthly: r.monthly.map((m) => ({ month: m.month, donated: Number(m.donated_kg), distributed: Number(m.distributed_kg) })),
  loss: r.loss_by_category.map((l) => ({ category: l.category, kg: Number(l.kg) })), donatedKg: Number(r.donated_kg),
  distributedKg: Number(r.distributed_kg), lossKg: Number(r.loss_kg), coveragePct: Number(r.coverage_pct),
})
export async function getReports(months: number): Promise<ReportData> {
  const now = new Date()
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1))
  return reportFromAPI(await http.get<ReportDTO>('/reports', { from: from.toISOString(), to: now.toISOString() }))
}
export async function getDashboard(): Promise<DashboardData> {
  const [raw, expiring, routes] = await Promise.all([
    http.get<ReportDTO>('/reports'), listLots({ pageSize: 4, status: 'critical' }), listRoutes(),
  ])
  const report = reportFromAPI(raw)
  return { ...report, kpis: { donatedKg: report.donatedKg, turnover: Number(raw.turnover), avgDeliveryHours: Number(raw.average_delivery_hours), coveragePct: report.coveragePct },
    expiring: expiring.items, routes: routes.map((r) => ({ id: r.id, name: r.name, done: r.stops.filter((s) => s.status === 'delivered').length, total: r.stops.length })) }
}
