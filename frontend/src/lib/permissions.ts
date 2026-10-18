import type { Permission, Role } from '../types'

const READ: Permission[] = [
  'stock:read', 'donation:read', 'donor:read', 'family:read', 'delivery:read', 'report:read', 'access:read',
]

/**
 * Matriz de perfis. No sistema real o backend valida cada requisição;
 * aqui ela só decide o que o front mostra, esconde ou bloqueia.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  manager: [...READ, 'stock:write', 'stock:dispose', 'donation:write', 'donor:write', 'family:write', 'delivery:write', 'access:write'],
  logistics: ['stock:read', 'stock:write', 'donation:read', 'donor:read', 'family:read', 'delivery:read', 'delivery:write', 'report:read'],
  volunteer: ['stock:read', 'donation:read', 'donation:write', 'donor:read'],
  auditor: READ,
}

export const ROLE_LABEL: Record<Role, string> = {
  manager: 'Gestor',
  logistics: 'Logística',
  volunteer: 'Voluntário',
  auditor: 'Auditor',
}

export const PERMISSION_LABEL: Record<Permission, string> = {
  'stock:read': 'Ver estoque',
  'stock:write': 'Registrar e remanejar lotes',
  'stock:dispose': 'Dar baixa em lotes',
  'donation:read': 'Ver doações',
  'donation:write': 'Registrar doações',
  'donor:read': 'Ver doadores',
  'donor:write': 'Cadastrar doadores',
  'family:read': 'Ver famílias',
  'family:write': 'Cadastrar famílias e consentimentos',
  'delivery:read': 'Ver entregas',
  'delivery:write': 'Criar rotas e confirmar entregas',
  'report:read': 'Ver relatórios',
  'access:read': 'Ver acessos e auditoria',
  'access:write': 'Alterar perfis e acessos',
}

export const can = (role: Role | undefined, permission: Permission): boolean =>
  role !== undefined && ROLE_PERMISSIONS[role].includes(permission)
