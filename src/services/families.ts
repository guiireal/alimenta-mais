import type { ConsentStatus, Family, FamilyInput } from '../types'
import { ApiError, db, logAudit, simulate } from './db'

export const listFamilies = (params: { q?: string; consent?: ConsentStatus | 'all' } = {}): Promise<Family[]> =>
  simulate(() => {
    const needle = (params.q ?? '').trim().toLowerCase()
    return db.families.filter(
      (f) =>
        (!params.consent || params.consent === 'all' || f.consent === params.consent) &&
        (!needle || f.code.toLowerCase().includes(needle) || f.neighborhood.toLowerCase().includes(needle)),
    )
  })

export const getFamily = (id: string): Promise<Family> =>
  simulate(() => {
    const family = db.families.find((f) => f.id === id)
    if (!family) throw new ApiError('Família não encontrada.', 404)
    return family
  })

export const createFamily = (input: FamilyInput): Promise<Family> =>
  simulate(() => {
    const n = db.families.reduce((max, f) => Math.max(max, Number(f.id.slice(1))), 0) + 1
    const family: Family = {
      id: `f${n}`,
      code: `F-${String(n).padStart(4, '0')}`,
      neighborhood: input.neighborhood.trim(),
      members: input.members,
      consent: input.consent ? 'granted' : 'pending',
      lastDeliveryAt: null,
    }
    db.families.push(family)
    logAudit('Família cadastrada', family.code)
    return family
  })

export const setConsent = (id: string, granted: boolean): Promise<Family> =>
  simulate(() => {
    const family = db.families.find((f) => f.id === id)
    if (!family) throw new ApiError('Família não encontrada.', 404)
    family.consent = granted ? 'granted' : 'pending'
    logAudit(granted ? 'Consentimento LGPD registrado' : 'Consentimento LGPD revogado', family.code)
    return family
  })

