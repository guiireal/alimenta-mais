import type { ConsentStatus, Family, FamilyInput } from '../types'
import { allPages, http } from './http'
export interface FamilyDTO { id: number; reference_code: string; contact_name: string; address: string; neighborhood: string; city: string; state: string; household_size: number; consent_granted_at: string | null; consent_revoked_at: string | null; last_delivery_at?: string | null; is_active: boolean }
export const familyFromAPI = (f: FamilyDTO): Family => ({
  id: String(f.id), code: f.reference_code, contactName: f.contact_name, address: f.address, neighborhood: f.neighborhood, city: f.city, state: f.state,
  members: f.household_size, consent: f.consent_granted_at && !f.consent_revoked_at ? 'granted' : 'pending', lastDeliveryAt: f.last_delivery_at ?? null, active: f.is_active,
})
export const listFamilies = async (params: { q?: string; consent?: ConsentStatus | 'all' } = {}): Promise<Family[]> =>
  (await allPages<FamilyDTO>('/overview/families', { q: params.q, status: params.consent === 'all' ? undefined : params.consent })).map(familyFromAPI)
export async function getFamily(id: string): Promise<Family> {
  const raw = await http.get<FamilyDTO>('/families/' + id)
  const matches = await listFamilies({ q: raw.reference_code })
  return matches.find((f) => f.id === id) ?? familyFromAPI(raw)
}
export const createFamily = async (input: FamilyInput): Promise<Family> => familyFromAPI(await http.post<FamilyDTO>('/families', {
  reference_code: input.code, contact_name: input.contactName, address: input.address, neighborhood: input.neighborhood,
  city: input.city, state: input.state, household_size: input.members,
}))
export const setConsent = async (id: string, granted: boolean): Promise<Family> => familyFromAPI(await http.put<FamilyDTO>('/families/' + id + '/consent', { granted, privacy_notice_version: 'v1' }))
