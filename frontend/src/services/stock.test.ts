import { afterEach, expect, it, vi } from 'vitest'
import { createLot, exportLots } from './stock'
afterEach(() => vi.unstubAllGlobals())
it('sends exact decimal strings and real product/warehouse IDs', async () => {
  vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } })
  vi.stubGlobal('document', { cookie: 'alimenta_csrf=test' })
  const fetcher = vi.fn().mockResolvedValue(new Response('{"id":42}', { status: 201 }))
  vi.stubGlobal('fetch', fetcher)
  expect(await createLot({ productId: '3', batchCode: 'LOTE-1', warehouse: '7', quantity: '0,001', unitWeightKg: '0,123456', expiresAt: '2030-10-10' })).toEqual({ id: '42' })
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ product_id: 3, batch_code: 'LOTE-1', warehouse_id: 7, quantity: '0.001', unit_weight_kg: '0.123456', expires_on: '2030-10-10', triage_status: 'approved' })
})
it('exports every server page respecting the maximum page size and filters', async () => {
  vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } })
  const lot = { id: 1, product_id: 1, batch_code: 'A', product_name: 'Arroz', category_name: 'Grãos', unit: 'kg', quantity: '1.001', expires_on: '2030-10-10', balances: [] }
  const fetcher = vi.fn().mockImplementation(async (url: URL) => {
    expect(url.searchParams.get('page_size')).toBe('100')
    expect(url.searchParams.get('category_id')).toBe('2')
    const page = Number(url.searchParams.get('page'))
    return new Response(JSON.stringify({ items: page === 1 ? Array(100).fill(lot) : [{ ...lot, id: 101 }], total: 101, page, page_size: 100 }))
  })
  vi.stubGlobal('fetch', fetcher)
  const result = await exportLots({ category: '2', status: 'critical' })
  expect(result.items).toHaveLength(101)
  expect(fetcher).toHaveBeenCalledTimes(2)
})
