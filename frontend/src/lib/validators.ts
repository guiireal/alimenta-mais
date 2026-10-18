import type { TriageStatus } from '../types'
import { onlyDigits, todayInput } from './utils'

export type Errors<T> = Partial<Record<keyof T, string>>
export const hasErrors = (errors: object): boolean => Object.values(errors).some(Boolean)

const REQUIRED = 'Campo obrigatório'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* Os valores de formulário são `type` (não `interface`) para casar com o `Record` exigido por useForm. */

/* ---------- login ---------- */
export type LoginValues = { email: string; password: string }
export const validateLogin = (v: LoginValues): Errors<LoginValues> => ({
  email: !v.email.trim() ? REQUIRED : !EMAIL.test(v.email.trim()) ? 'Informe um e-mail válido' : undefined,
  password: !v.password ? REQUIRED : undefined,
})

/* ---------- cadastro de conta ---------- */
export type RegisterValues = { name: string; email: string; password: string; confirm: string; accept: boolean }
export const passwordProblem = (password: string): string | undefined =>
  !password ? REQUIRED
  : password.length < 8 ? 'Use ao menos 8 caracteres'
  : new TextEncoder().encode(password).length > 72 ? 'Use no máximo 72 bytes'
  : !/[A-Za-z]/.test(password) || !/\d/.test(password) ? 'Misture letras e números'
  : undefined
export const validateRegister = (v: RegisterValues): Errors<RegisterValues> => ({
  name: !v.name.trim() ? REQUIRED : v.name.trim().length < 3 ? 'Use ao menos 3 caracteres' : undefined,
  email: !v.email.trim() ? REQUIRED : !EMAIL.test(v.email.trim()) ? 'Informe um e-mail válido' : undefined,
  password: passwordProblem(v.password),
  confirm: !v.confirm ? REQUIRED : v.confirm !== v.password ? 'As senhas não são iguais' : undefined,
  accept: v.accept ? undefined : 'Aceite o uso dos dados para criar a conta',
})

/* ---------- lote ---------- */
export type LotValues = { productId: string; batchCode: string; quantity: string; unitWeightKg: string; expiresAt: string; warehouse: string }
export const decimalProblem = (value: string, scale = 3): string | undefined =>
  !new RegExp(`^\\d+(?:[.,]\\d{1,${scale}})?$`).test(value.trim()) || Number(value.replace(',', '.')) <= 0 ? `Informe um valor positivo com até ${scale} casas decimais` : undefined
export const validateLot = (v: LotValues, approved = true): Errors<LotValues> => {
  const today = new Date().toISOString().slice(0, 10)
  return {
    productId: !v.productId ? REQUIRED : undefined,
    batchCode: !v.batchCode.trim() ? REQUIRED : undefined,
    quantity: decimalProblem(v.quantity),
    unitWeightKg: decimalProblem(v.unitWeightKg, 6),
    expiresAt: approved && !v.expiresAt ? REQUIRED : approved && v.expiresAt < today ? 'Item vencido não pode dar entrada no estoque' : undefined,
    warehouse: approved && !v.warehouse ? REQUIRED : undefined,
  }
}

/* ---------- doador ---------- */
export type DonorValues = { name: string; type: string; email: string; phone: string }
export const validateDonor = (v: DonorValues): Errors<DonorValues> => {
  const phone = onlyDigits(v.phone)
  return {
    name: !v.name.trim() ? REQUIRED : v.name.trim().length < 3 ? 'Use ao menos 3 caracteres' : undefined,
    type: !v.type ? REQUIRED : undefined,
    email: v.email.trim() && !EMAIL.test(v.email.trim()) ? 'Informe um e-mail válido' : undefined,
    phone: v.phone.trim() && (phone.length < 10 || phone.length > 11) ? 'Use DDD e número, com 10 ou 11 dígitos' : undefined,
  }
}

/* ---------- família ---------- */
export type FamilyValues = { code: string; contactName: string; address: string; neighborhood: string; city: string; state: string; members: string }
export const validateFamily = (v: FamilyValues): Errors<FamilyValues> => {
  const n = Number(v.members)
  return {
    code: !v.code.trim() ? REQUIRED : undefined,
    contactName: !v.contactName.trim() ? REQUIRED : undefined,
    address: !v.address.trim() ? REQUIRED : undefined,
    neighborhood: !v.neighborhood.trim() ? REQUIRED : undefined,
    city: !v.city.trim() ? REQUIRED : undefined,
    state: !/^[A-Z]{2}$/.test(v.state) ? 'Informe a UF com duas letras maiúsculas' : undefined,
    members: !v.members.trim() ? REQUIRED : !Number.isInteger(n) || n < 1 || n > 20 ? 'Informe de 1 a 20 pessoas' : undefined,
  }
}

/* ---------- rota ---------- */
export type RouteValues = { name: string; warehouseId: string; scheduledOn: string; assignedTo: string }
export const validateRoute = (v: RouteValues): Errors<RouteValues> => ({
  name: !v.name.trim() ? REQUIRED : undefined,
  warehouseId: !v.warehouseId ? REQUIRED : undefined,
  scheduledOn: !v.scheduledOn ? REQUIRED : undefined,
})

/* ---------- baixa de lote ---------- */
export const validateDisposal = (reason: string): string | undefined => (reason ? undefined : 'Escolha o motivo da baixa')

/* ---------- doação (itens dinâmicos) ---------- */
export type DraftItem = LotValues & { key: string; triage: TriageStatus }
type ItemField = keyof LotValues
export interface DonationErrors {
  donorId?: string
  receivedAt?: string
  items?: string
  byItem: Record<string, Partial<Record<ItemField, string>>>
}

export const validateDonation = (v: { donorId: string; receivedAt: string; items: DraftItem[] }): DonationErrors => {
  const today = todayInput()
  const byItem: DonationErrors['byItem'] = {}
  for (const item of v.items) {
    const e = validateLot(item, item.triage === 'approved')
    if (hasErrors(e)) byItem[item.key] = e
  }
  return {
    donorId: !v.donorId ? 'Escolha o doador' : undefined,
    receivedAt: !v.receivedAt ? REQUIRED : v.receivedAt > today ? 'A data não pode estar no futuro' : undefined,
    items: v.items.length === 0 ? 'Adicione ao menos um item' : undefined,
    byItem,
  }
}
export const donationHasErrors = (e: DonationErrors): boolean => Boolean(e.donorId || e.receivedAt || e.items || Object.keys(e.byItem).length)
