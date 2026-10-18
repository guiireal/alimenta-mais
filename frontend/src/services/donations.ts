import type { Donation, DonationInput, Donor, DonorInput, DonationStage } from '../types'
import { batchBody } from './stock'
import { allPages, http, type Page } from './http'

export interface DonorDTO { id: number; name: string; type: 'individual' | 'company'; total_kg?: string; donations_count?: number; last_donation_at?: string | null; email: string | null; phone: string | null; is_active: boolean }
export interface DonationDTO { id: number; donor_id: number; donor_name: string; donor_type: DonorDTO['type']; received_at: string | null; created_at: string; status: 'draft' | 'received' | 'in_triage' | 'stored' | 'available'; weight_kg: string; document_reference: string | null; confirmed_at: string | null }
export interface BatchDTO { id: number; product_id: number; batch_code: string; received_quantity: string; unit_weight_kg: string; expires_on: string | null; triage_status: 'pending' | 'approved' | 'rejected' }
export interface DonationDetail { donation: DonationDTO; batches: BatchDTO[] }
export const donorFromAPI = (d: DonorDTO): Donor => ({
  id: String(d.id), name: d.name, type: d.type === 'company' ? 'PJ' : 'PF', totalKg: Number(d.total_kg ?? 0),
  donationsCount: d.donations_count ?? 0, lastDonationAt: d.last_donation_at ?? null, email: d.email ?? undefined, phone: d.phone ?? undefined,
})
export const donationFromAPI = (d: DonationDTO): Donation => ({
  id: String(d.id), donorId: String(d.donor_id), donorName: d.donor_name, donorType: d.donor_type === 'company' ? 'PJ' : 'PF',
  receivedAt: d.received_at ?? d.created_at, stage: (d.status === 'in_triage' ? 'triage' : d.status) as DonationStage,
  weightKg: Number(d.weight_kg), document: d.document_reference ?? undefined,
})
export const listDonations = async (): Promise<Donation[]> => (await allPages<DonationDTO>('/overview/donations')).map(donationFromAPI)
export const getDonation = (id: string) => http.get<DonationDetail>('/donations/' + id)
export const triageBatch = (input: { id: string; status: 'approved' | 'rejected'; warehouseId: string; expiresOn: string; notes: string }) =>
  http.post('/batches/' + input.id + '/triage', { status: input.status, warehouse_id: Number(input.warehouseId || 0), expires_on: input.expiresOn || null, notes: input.notes })
export const confirmDonation = (id: string) => http.post('/donations/' + id + '/confirm')
export async function createDonation(input: DonationInput): Promise<{ donation: { id: string }; lotIds: string[] }> {
  const data = await http.post<DonationDetail>('/donations', {
    donor_id: Number(input.donorId), received_at: new Date(input.receivedAt + 'T00:00:00').toISOString(),
    document_reference: input.document.trim() || null,
    items: input.items.map((i) => ({ ...batchBody(i), triage_status: i.triage === 'review' ? 'pending' : i.triage })),
  })
  return { donation: { id: String(data.donation.id) }, lotIds: data.batches.filter((b) => b.triage_status === 'approved').map((b) => String(b.id)) }
}
export const listDonors = async (q = ''): Promise<Donor[]> => (await allPages<DonorDTO>('/overview/donors', { q })).map(donorFromAPI)
export async function getDonor(id: string): Promise<{ donor: Donor; donations: Donation[] }> {
  const [donor, donations] = await Promise.all([
    http.get<Page<DonorDTO>>('/overview/donors', { donor_id: id }),
    allPages<DonationDTO>('/overview/donations', { donor_id: id }),
  ])
  if (!donor.items[0]) { await http.get('/donors/' + id); throw new Error('Doador não encontrado') }
  return { donor: donorFromAPI(donor.items[0]), donations: donations.map(donationFromAPI) }
}
export const createDonor = async (input: DonorInput): Promise<Donor> => donorFromAPI(await http.post<DonorDTO>('/donors', {
  name: input.name, type: input.type === 'PJ' ? 'company' : 'individual', email: input.email.trim() || null, phone: input.phone.trim() || null,
}))
