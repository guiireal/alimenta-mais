import type { Category, TriageStatus } from '../types'
import { isPerishable, onlyDigits, parseNumber, todayInput } from './utils'

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
export type LotValues = { item: string; category: string; quantity: string; unit: string; expiresAt: string; warehouse: string }
export const validateLot = (v: LotValues): Errors<LotValues> => {
  const qty = parseNumber(v.quantity)
  return {
    item: !v.item.trim() ? REQUIRED : v.item.trim().length < 3 ? 'Use ao menos 3 caracteres' : undefined,
    category: !v.category ? REQUIRED : undefined,
    quantity: !v.quantity.trim() ? REQUIRED : !Number.isFinite(qty) || qty <= 0 ? 'Informe uma quantidade maior que zero' : v.unit === 'un' && !Number.isInteger(qty) ? 'Unidades devem ser números inteiros' : undefined,
    expiresAt: v.expiresAt && v.expiresAt < todayInput() ? 'Item vencido não pode dar entrada no estoque' : undefined,
    warehouse: !v.warehouse ? REQUIRED : v.category && isPerishable(v.category as Category) && v.warehouse !== 'Câmara fria' ? 'Perecíveis devem ficar na câmara fria' : undefined,
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
export type FamilyValues = { neighborhood: string; members: string; consent: boolean }
export const validateFamily = (v: FamilyValues): Errors<FamilyValues> => {
  const n = Number(v.members)
  return {
    neighborhood: !v.neighborhood.trim() ? REQUIRED : undefined,
    members: !v.members.trim() ? REQUIRED : !Number.isInteger(n) || n < 1 || n > 20 ? 'Informe de 1 a 20 pessoas' : undefined,
  }
}

/* ---------- rota ---------- */
export type RouteValues = { name: string; vehicle: string; driver: string; startTime: string; familyIds: string[] }
export const validateRoute = (v: RouteValues): Errors<RouteValues> => ({
  name: !v.name.trim() ? REQUIRED : undefined,
  vehicle: !v.vehicle ? REQUIRED : undefined,
  driver: !v.driver ? REQUIRED : undefined,
  startTime: !v.startTime ? REQUIRED : undefined,
  familyIds: v.familyIds.length === 0 ? 'Escolha ao menos uma família' : undefined,
})

/* ---------- baixa de lote ---------- */
export const validateDisposal = (reason: string): string | undefined => (reason ? undefined : 'Escolha o motivo da baixa')

/* ---------- doação (itens dinâmicos) ---------- */
export interface DraftItem { key: string; name: string; category: string; quantity: string; expiresAt: string; triage: TriageStatus }
type ItemField = 'name' | 'category' | 'quantity' | 'expiresAt'
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
    const qty = parseNumber(item.quantity)
    const e: Partial<Record<ItemField, string>> = {
      name: !item.name.trim() ? REQUIRED : undefined,
      category: !item.category ? REQUIRED : undefined,
      quantity: !item.quantity.trim() ? REQUIRED : !Number.isFinite(qty) || qty <= 0 ? 'Quantidade maior que zero' : undefined,
      expiresAt:
        item.triage === 'approved' && !item.expiresAt ? 'Validade obrigatória para item aprovado'
        : item.expiresAt && item.expiresAt < today && item.triage === 'approved' ? 'Item vencido não pode ser aprovado'
        : undefined,
    }
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
