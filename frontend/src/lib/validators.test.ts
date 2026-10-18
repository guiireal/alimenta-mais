import { describe, expect, it } from 'vitest'
import { donationHasErrors, validateDonation, validateDonor, validateFamily, validateLogin, validateLot, validateRegister, validateRoute } from './validators'
import { todayInput } from './utils'

const lot = { item: 'Leite integral', category: 'Laticínios', quantity: '10', unit: 'un', expiresAt: '', warehouse: 'Câmara fria' }

describe('validateLot', () => {
  it('aceita um lote válido', () => expect(Object.values(validateLot(lot)).some(Boolean)).toBe(false))
  it('exige câmara fria para perecíveis', () => expect(validateLot({ ...lot, warehouse: 'Seco A' }).warehouse).toMatch(/câmara fria/))
  it('recusa item vencido e quantidade quebrada em unidades', () => {
    expect(validateLot({ ...lot, expiresAt: '2000-01-01' }).expiresAt).toBeDefined()
    expect(validateLot({ ...lot, quantity: '2,5' }).quantity).toBeDefined()
  })
})

describe('outros formulários', () => {
  it('login', () => expect(validateLogin({ email: 'x', password: '' })).toEqual({ email: 'Informe um e-mail válido', password: 'Campo obrigatório' }))
  it('doador: e-mail e telefone opcionais, mas validados quando preenchidos', () => {
    expect(validateDonor({ name: 'Padaria', type: 'PJ', email: '', phone: '' }).email).toBeUndefined()
    expect(validateDonor({ name: 'Padaria', type: 'PJ', email: 'a@b', phone: '123' })).toMatchObject({ email: expect.any(String), phone: expect.any(String) })
  })
  it('família', () => expect(validateFamily({ neighborhood: 'Centro', members: '25', consent: false }).members).toBeDefined())
  it('rota exige ao menos uma família', () =>
    expect(validateRoute({ name: 'R', vehicle: 'Van', driver: 'A', startTime: '09:00', familyIds: [] }).familyIds).toBeDefined())
})

describe('validateDonation', () => {
  const item = { key: 'a', name: 'Leite', category: 'Laticínios', quantity: '5', expiresAt: '', triage: 'approved' as const }
  it('item aprovado precisa de validade', () => {
    const e = validateDonation({ donorId: 'DN-01', receivedAt: todayInput(), items: [item] })
    expect(e.byItem.a.expiresAt).toBeDefined()
    expect(donationHasErrors(e)).toBe(true)
  })
  it('item recusado não precisa de validade', () => {
    const e = validateDonation({ donorId: 'DN-01', receivedAt: todayInput(), items: [{ ...item, triage: 'rejected' }] })
    expect(donationHasErrors(e)).toBe(false)
  })
})

describe('validateRegister', () => {
  const ok = { name: 'Maria Teste', email: 'maria@teste.com', password: 'senha1234', confirm: 'senha1234', accept: true }
  it('aceita um cadastro válido', () => expect(Object.values(validateRegister(ok)).some(Boolean)).toBe(false))
  it('exige letras e números, mínimo de 8 caracteres', () => {
    expect(validateRegister({ ...ok, password: 'curta1', confirm: 'curta1' }).password).toBeDefined()
    expect(validateRegister({ ...ok, password: 'somenteletras', confirm: 'somenteletras' }).password).toBeDefined()
  })
  it('confere as senhas e o aceite da LGPD', () => {
    expect(validateRegister({ ...ok, confirm: 'outra1234' }).confirm).toBeDefined()
    expect(validateRegister({ ...ok, accept: false }).accept).toBeDefined()
  })
})
