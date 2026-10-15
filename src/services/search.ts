import type { Donation, Donor, Family, StockLot } from '../types'
import { db, simulate } from './db'

export interface SearchScope { stock: boolean; donors: boolean; families: boolean; donations: boolean }
export interface SearchResults { lots: StockLot[]; donors: Donor[]; families: Family[]; donations: Donation[] }

export const MIN_QUERY_LENGTH = 2
const LIMIT = 8

/** Busca global. O escopo vem do perfil: ninguém recebe resultado de um módulo que não pode ver. */
export const searchAll = (q: string, scope: SearchScope): Promise<SearchResults> =>
  simulate(() => {
    const needle = q.trim().toLowerCase()
    const has = (...parts: string[]) => parts.some((p) => p.toLowerCase().includes(needle))
    if (needle.length < MIN_QUERY_LENGTH) return { lots: [], donors: [], families: [], donations: [] }
    return {
      lots: scope.stock ? db.lots.filter((l) => l.status === 'active' && has(l.item, l.id, l.category)).slice(0, LIMIT) : [],
      donors: scope.donors ? db.donors.filter((d) => has(d.name, d.id)).slice(0, LIMIT) : [],
      families: scope.families ? db.families.filter((f) => has(f.code, f.neighborhood)).slice(0, LIMIT) : [],
      donations: scope.donations ? db.donations.filter((d) => has(d.id, d.donorName, d.document ?? '')).slice(0, LIMIT) : [],
    }
  })
