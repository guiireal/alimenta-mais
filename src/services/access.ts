import type { AppUser, AuditEntry, Role } from '../types'
import { ApiError, db, logAudit, persistUsers, simulate } from './db'

export const listUsers = (): Promise<AppUser[]> => simulate(() => db.users)
export const listAudit = (): Promise<AuditEntry[]> => simulate(() => db.audit)

export const updateUser = (id: string, patch: { role?: Role; active?: boolean }, actorId: string): Promise<AppUser> =>
  simulate(() => {
    const user = db.users.find((u) => u.id === id)
    if (!user) throw new ApiError('Usuário não encontrado.', 404)
    if (id === actorId) throw new ApiError('Você não pode alterar o próprio acesso.', 409)
    const after = db.users.map((u) => (u.id === id ? { ...u, ...patch } : u))
    if (!after.some((u) => u.role === 'manager' && u.active)) throw new ApiError('O sistema precisa de ao menos um gestor ativo.', 409)
    Object.assign(user, patch)
    persistUsers()
    logAudit(patch.role ? 'Perfil de acesso alterado' : user.active ? 'Usuário reativado' : 'Usuário desativado', id)
    return user
  })
