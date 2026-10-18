import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StockLot } from '../types'
import { daysLabel, daysUntil, getExpiryStatus, parseNumber, sortByFefo } from './utils'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-17T13:00:00Z')) })
afterEach(() => vi.useRealTimers())

const inDays = (n: number): string => {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + n)
  return d.toISOString()
}
const lot = (id: string, expiresAt: string | null): StockLot => ({ id, batchCode: id, productId: '1', balances: [], item: id, category: 'Grãos', quantity: 1, unit: 'un', expiresAt, warehouse: 'Seco A', status: 'active' })

describe('getExpiryStatus', () => {
  it.each([
    [-1, 'expired'], [0, 'critical'], [2, 'critical'], [3, 'warning'], [7, 'warning'], [8, 'ok'],
  ])('%i dias => %s', (days, expected) => {
    expect(getExpiryStatus(inDays(days))).toBe(expected)
  })
  it('sem validade', () => expect(getExpiryStatus(null)).toBe('none'))
})

describe('daysLabel', () => {
  it('usa o mesmo dia UTC do backend na virada do dia', () => {
    vi.setSystemTime(new Date('2026-10-18T00:30:00Z'))
    expect(daysUntil('2026-10-18')).toBe(0)
    expect(getExpiryStatus('2026-10-17')).toBe('expired')
  })
  it('descreve vencido, hoje e futuro', () => {
    expect(daysUntil(inDays(2))).toBe(2)
    expect(daysLabel(inDays(-1))).toBe('vencido há 1 dia')
    expect(daysLabel(inDays(0))).toBe('vence hoje')
    expect(daysLabel(inDays(5))).toBe('vence em 5 dias')
  })
})

describe('sortByFefo', () => {
  it('ordena do que vence primeiro e deixa lotes sem validade no fim', () => {
    const sorted = sortByFefo([lot('c', null), lot('b', inDays(10)), lot('a', inDays(1))])
    expect(sorted.map((l) => l.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('parseNumber', () => {
  it('aceita vírgula decimal', () => expect(parseNumber('2,5')).toBe(2.5))
})
