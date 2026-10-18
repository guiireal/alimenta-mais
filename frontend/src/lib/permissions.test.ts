import { describe, expect, it } from 'vitest'
import { can, ROLE_PERMISSIONS } from './permissions'
describe('perfis da API', () => {
  it('administrador tem todas as permissões', () => expect(Object.values(ROLE_PERMISSIONS).flat().every((p) => can('administrator', p))).toBe(true))
  it('gestor opera, sem alterar acessos', () => { expect(can('manager', 'stock:write')).toBe(true); expect(can('manager', 'access:read')).toBe(true); expect(can('manager', 'access:write')).toBe(false) })
  it('operador consulta estoque e registra doações, sem dados de famílias', () => { expect(can('operator', 'donation:write')).toBe(true); expect(can('operator', 'family:read')).toBe(false); expect(can('operator', 'stock:dispose')).toBe(false) })
  it('sem perfil não há acesso', () => expect(can(undefined, 'stock:read')).toBe(false))
})
