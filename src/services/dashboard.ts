import { kpis, lossByCategory, monthly } from '../data/mock'
import type { Kpis, LossByCategory, MonthlyPoint, StockLot } from '../types'
import { sortByFefo } from '../lib/utils'
import { db, simulate } from './db'

export interface DashboardData {
  kpis: Kpis
  monthly: MonthlyPoint[]
  loss: LossByCategory[]
  expiring: StockLot[]
  routes: { id: string; name: string; done: number; total: number }[]
}

export const getDashboard = (): Promise<DashboardData> =>
  simulate(() => ({
    kpis,
    monthly,
    loss: lossByCategory,
    expiring: sortByFefo(db.lots.filter((l) => l.status === 'active' && l.expiresAt)).slice(0, 4),
    routes: db.routes.map((r) => ({ id: r.id, name: r.name, done: r.stops.filter((s) => s.status === 'delivered').length, total: r.stops.length })),
  }))

export interface ReportData {
  monthly: MonthlyPoint[]
  loss: LossByCategory[]
  donatedKg: number
  distributedKg: number
  lossKg: number
  coveragePct: number
}

export const getReports = (months: number): Promise<ReportData> =>
  simulate(() => {
    const slice = monthly.slice(-months)
    return {
      monthly: slice,
      loss: lossByCategory,
      donatedKg: slice.reduce((s, m) => s + m.donated, 0),
      distributedKg: slice.reduce((s, m) => s + m.distributed, 0),
      lossKg: lossByCategory.reduce((s, l) => s + l.kg, 0),
      coveragePct: kpis.coveragePct,
    }
  })
