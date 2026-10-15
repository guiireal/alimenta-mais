import { describe, expect, it } from 'vitest'
import { createDonation } from './donations'
import { createLot, disposeLot, getLot, getStockStats, listLots, transferLot } from './stock'

const failsWith = async (promise: Promise<unknown>, status: number) =>
  promise.then(() => false, (e: { status?: number }) => e.status === status)

describe('estoque (mock)', () => {
  it('lista pelo FEFO, filtra e pagina', async () => {
    const first = await listLots({ pageSize: 4 })
    expect(first.items[0].id).toBe('L-0003') // o vencido sai primeiro
    expect((await listLots({ status: 'alert' })).total).toBe(3)
    expect((await listLots({ q: 'leite' })).total).toBe(1)
    expect((await listLots({ page: 99, pageSize: 4 })).page).toBe(3)
  })

  it('aplica a regra de perecíveis e o ciclo remanejar e dar baixa', async () => {
    expect(await failsWith(createLot({ item: 'Leite', category: 'Laticínios', quantity: 5, unit: 'un', expiresAt: null, warehouse: 'Seco A' }), 422)).toBe(true)
    const lot = await createLot({ item: 'Arroz', category: 'Grãos', quantity: 5, unit: 'un', expiresAt: null, warehouse: 'Seco B' })
    await transferLot(lot.id, 'Seco A')
    expect(await failsWith(transferLot(lot.id, 'Seco A'), 409)).toBe(true)
    await disposeLot(lot.id, 'Avaria')
    expect(await failsWith(disposeLot(lot.id, 'Avaria'), 409)).toBe(true)
    expect((await getLot(lot.id)).movements).toHaveLength(3)
  })

  it('doação aprovada vira lote; item recusado não', async () => {
    const before = (await getStockStats()).registeredPct
    const { lotIds, donation } = await createDonation({
      donorId: 'DN-01', receivedAt: '2026-10-14', document: 'N-1',
      items: [
        { name: 'Leite', category: 'Laticínios', quantity: 10, expiresAt: '2030-01-01', triage: 'approved' },
        { name: 'Iogurte', category: 'Laticínios', quantity: 3, expiresAt: null, triage: 'rejected' },
      ],
    })
    expect(lotIds).toHaveLength(1)
    expect(donation.stage).toBe('triage')
    expect(typeof before).toBe('number')
  })
})
