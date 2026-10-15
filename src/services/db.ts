import { config } from '../config'
import * as seed from '../data/mock'
import type { AppUser, StockMovement } from '../types'

/**
 * Banco em memória que simula o servidor. Existe só para o mock:
 * quando o backend existir, este arquivo e os services passam a chamar a API (veja http.ts).
 */
export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const clone = <T>(value: T): T => structuredClone(value)
const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString()

export const db = {
  lots: clone(seed.stockLots),
  movements: [] as StockMovement[],
  donors: clone(seed.donors),
  donations: clone(seed.donations),
  families: clone(seed.families),
  routes: clone(seed.routes),
  users: clone(seed.users),
  /** Hash da senha por usuário. Quem não aparece aqui usa a senha de demonstração. */
  passwordHashes: {} as Record<string, string>,
  audit: clone(seed.auditLog),
}

/* As contas criadas precisam sobreviver ao F5, senão o cadastro "some". Só o mock faz isso:
   com backend real, quem guarda usuários e senhas (com hash forte) é o servidor. */
const USERS_KEY = 'alimenta:mock:users:v1'
const storage = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

try {
  const saved = storage()?.getItem(USERS_KEY)
  if (saved) {
    const parsed = JSON.parse(saved) as { users: AppUser[]; hashes: Record<string, string> }
    db.users = parsed.users
    db.passwordHashes = parsed.hashes
  }
} catch { /* dado corrompido: segue com o seed */ }

export function persistUsers(): void {
  try { storage()?.setItem(USERS_KEY, JSON.stringify({ users: db.users, hashes: db.passwordHashes })) } catch { /* sem persistência */ }
}

db.movements = db.lots.map((l) => ({
  id: `M-${l.id}`, lotId: l.id, at: daysAgo(5), type: 'entry', user: 'Bruna Reis', note: 'Entrada inicial no estoque',
}))

/** Quem está logado. No servidor real isso vem do token da requisição. */
let actor = 'Sistema'
export const setActor = (name: string): void => { actor = name }
export const getActor = (): string => actor

/** Responde de forma assíncrona, com latência simulada, devolvendo cópias dos dados. */
export function simulate<T>(fn: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(clone(fn()))
      } catch (error) {
        reject(error)
      }
    }, config.mockLatencyMs)
  })
}

export const nextId = (prefix: string, ids: string[], pad = 4): string => {
  const max = ids.reduce((acc, id) => Math.max(acc, Number(id.replace(/\D/g, '')) || 0), 0)
  return `${prefix}-${String(max + 1).padStart(pad, '0')}`
}

export const nowIso = (): string => new Date().toISOString()

export function logAudit(action: string, entity: string, user: string = actor): void {
  db.audit.unshift({ id: nextId('A', db.audit.map((a) => a.id), 1), at: nowIso(), user, action, entity })
}

export function logMovement(lotId: string, type: StockMovement['type'], note: string): void {
  db.movements.push({ id: nextId('M', db.movements.map((m) => m.id), 4), lotId, at: nowIso(), type, user: actor, note })
}
