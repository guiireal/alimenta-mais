import { describe, expect, it } from 'vitest'
import { can, ROLE_PERMISSIONS } from './permissions'

describe('permissões por perfil', () => {
  it('gestor faz tudo que algum perfil faz', () => {
    const all = new Set(Object.values(ROLE_PERMISSIONS).flat())
    expect([...all].every((p) => can('manager', p))).toBe(true)
  })
  it('auditor só lê', () => expect(ROLE_PERMISSIONS.auditor.every((p) => p.endsWith(':read'))).toBe(true))
  it('voluntário não vê famílias nem dá baixa', () => {
    expect(can('volunteer', 'family:read')).toBe(false)
    expect(can('volunteer', 'stock:dispose')).toBe(false)
  })
  it('sem perfil, sem acesso', () => expect(can(undefined, 'stock:read')).toBe(false))
})
