import type { AppUser, AuditEntry, Role } from '../types'
import { allPages, http, type Page } from './http'
import { userFromAPI, type UserDTO } from './auth'
export const listUsers = async (): Promise<AppUser[]> => (await allPages<UserDTO>('/users')).map(userFromAPI)
export const listAudit = async (): Promise<AuditEntry[]> => {
  const data = await http.get<Page<{ id: number; occurred_at: string; actor_id: number | null; action: string; entity_table: string | null; entity_id: number | null }>>('/audit', { page_size: 100 })
  return data.items.map((a) => ({ id: String(a.id), at: a.occurred_at, user: a.actor_id ? 'Usuário #' + a.actor_id : 'Sistema', action: a.action, entity: (a.entity_table ?? '') + ' #' + (a.entity_id ?? '') }))
}
export const updateUser = async (id: string, access: { role: Role; active: boolean }): Promise<AppUser> =>
  userFromAPI(await http.put<UserDTO>('/users/' + id + '/access', { role: access.role, is_active: access.active }))
