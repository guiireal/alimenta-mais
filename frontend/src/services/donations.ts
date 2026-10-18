import type { Donation, DonationInput, Donor, DonorInput, StockLot } from '../types'
import { defaultWarehouse } from '../lib/utils'
import { ApiError, db, logAudit, logMovement, nextId, simulate } from './db'

/* ---------- doações ---------- */
export const listDonations = (): Promise<Donation[]> =>
  simulate(() => [...db.donations].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)))

/** Itens aprovados viram lotes no estoque; recusados ficam só no registro da doação. */
export const createDonation = (input: DonationInput): Promise<{ donation: Donation; lotIds: string[] }> =>
  simulate(() => {
    const donor = db.donors.find((d) => d.id === input.donorId)
    if (!donor) throw new ApiError('Doador não encontrado.', 404)
    if (input.items.length === 0 || input.items.some((i) => i.quantity <= 0)) throw new ApiError('Itens inválidos.', 422)

    const donationId = nextId('D', db.donations.map((d) => d.id))
    const lotIds: string[] = []
    for (const item of input.items.filter((i) => i.triage === 'approved')) {
      const lot: StockLot = {
        id: nextId('L', db.lots.map((l) => l.id)),
        item: item.name.trim(),
        category: item.category,
        quantity: item.quantity,
        unit: 'un',
        expiresAt: item.expiresAt ? new Date(`${item.expiresAt}T12:00:00`).toISOString() : null,
        warehouse: defaultWarehouse(item.category),
        status: 'active',
      }
      db.lots.push(lot)
      logMovement(lot.id, 'entry', `Doação ${donationId}`)
      lotIds.push(lot.id)
    }

    const weightKg = input.items.reduce((sum, i) => sum + i.quantity, 0)
    const donation: Donation = {
      id: donationId,
      donorId: donor.id,
      donorName: donor.name,
      donorType: donor.type,
      receivedAt: new Date(`${input.receivedAt}T12:00:00`).toISOString(),
      stage: input.items.some((i) => i.triage !== 'approved') ? 'triage' : 'stored',
      weightKg,
      document: input.document.trim() || undefined,
    }
    db.donations.push(donation)
    donor.totalKg += weightKg
    donor.donationsCount += 1
    donor.lastDonationAt = donation.receivedAt
    logAudit('Doação registrada', donationId)
    return { donation, lotIds }
  })

/* ---------- doadores ---------- */
export const listDonors = (q = ''): Promise<Donor[]> =>
  simulate(() => {
    const needle = q.trim().toLowerCase()
    return db.donors.filter((d) => !needle || d.name.toLowerCase().includes(needle)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  })

export const getDonor = (id: string): Promise<{ donor: Donor; donations: Donation[] }> =>
  simulate(() => {
    const donor = db.donors.find((d) => d.id === id)
    if (!donor) throw new ApiError('Doador não encontrado.', 404)
    return { donor, donations: db.donations.filter((d) => d.donorId === id).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)) }
  })

export const createDonor = (input: DonorInput): Promise<Donor> =>
  simulate(() => {
    const name = input.name.trim()
    if (db.donors.some((d) => d.name.toLowerCase() === name.toLowerCase())) throw new ApiError('Já existe um doador com esse nome.', 409)
    const donor: Donor = {
      id: nextId('DN', db.donors.map((d) => d.id), 2),
      name,
      type: input.type,
      totalKg: 0,
      donationsCount: 0,
      lastDonationAt: null,
      email: input.email.trim() || undefined,
      phone: input.phone.trim() || undefined,
    }
    db.donors.push(donor)
    logAudit('Doador cadastrado', donor.id)
    return donor
  })

