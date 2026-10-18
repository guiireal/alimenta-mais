import { describe, expect, it } from 'vitest'
import { decimalProblem, donationHasErrors, validateDonation, validateFamily, validateLogin, validateLot, validateRegister, validateRoute } from './validators'
import { todayInput } from './utils'
const lot = { productId: '1', batchCode: 'ABC', quantity: '10', unitWeightKg: '0.123456', expiresAt: new Date().toISOString().slice(0, 10), warehouse: '2' }
describe('formulários reais', () => {
  it('exige código, produto, validade e depósito para entrada aprovada', () => {
    expect(Object.values(validateLot(lot)).some(Boolean)).toBe(false)
    expect(validateLot({ ...lot, productId: '', expiresAt: '', warehouse: '' })).toMatchObject({ productId: expect.any(String), expiresAt: expect.any(String), warehouse: expect.any(String) })
    expect(validateLot({ ...lot, expiresAt: '2000-01-01' }).expiresAt).toBeDefined()
  })
  it('valida a precisão sem arredondar entradas', () => { expect(decimalProblem('0,001')).toBeUndefined(); expect(decimalProblem('0.0001')).toBeDefined(); expect(decimalProblem('0')).toBeDefined(); expect(decimalProblem('1e3')).toBeDefined() })
  it('triagem pendente não exige depósito nem validade', () => {
    expect(donationHasErrors(validateDonation({ donorId: '1', receivedAt: todayInput(), items: [{ ...lot, key: 'a', expiresAt: '', warehouse: '', triage: 'review' }] }))).toBe(false)
    expect(donationHasErrors(validateDonation({ donorId: '1', receivedAt: todayInput(), items: [{ ...lot, key: 'a', expiresAt: '', triage: 'approved' }] }))).toBe(true)
  })
  it('família exige endereço e UF; rota exige origem e data', () => {
    expect(validateFamily({ code: 'F1', contactName: 'Maria', address: '', neighborhood: 'Centro', city: 'São Paulo', state: 'sp', members: '0' })).toMatchObject({ address: expect.any(String), state: expect.any(String), members: expect.any(String) })
    expect(validateRoute({ name: 'R1', warehouseId: '', scheduledOn: '', assignedTo: '' })).toMatchObject({ warehouseId: expect.any(String), scheduledOn: expect.any(String) })
  })
  it('login e cadastro validam credenciais e limite de bcrypt em bytes', () => {
    expect(validateLogin({ email: 'bad', password: '' }).email).toBeDefined()
    const ok = { name: 'Maria', email: 'maria@example.test', password: 'Secret1234', confirm: 'Secret1234', accept: true }
    expect(Object.values(validateRegister(ok)).some(Boolean)).toBe(false)
    expect(validateRegister({ ...ok, password: 'á'.repeat(36) + 'a1' }).password).toBeDefined()
    expect(validateRegister({ ...ok, confirm: 'other' }).confirm).toBeDefined()
    expect(validateRegister({ ...ok, accept: false }).accept).toBeDefined()
  })
})
