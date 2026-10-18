import type { AppUser } from '../types'
import { http } from './http'
import { errorMessage } from '../lib/utils'

export interface UserDTO { id: number; name: string; email: string; role: AppUser['role']; is_active: boolean }
export const userFromAPI = (u: UserDTO): AppUser => ({ id: String(u.id), name: u.name, email: u.email, role: u.role, active: u.is_active })
export async function login(email: string, password: string): Promise<AppUser> {
  const session = await http.post<{ user: UserDTO; expires_at: string }>('/auth/login', { email, password })
  return userFromAPI(session.user)
}
export async function register(input: { name: string; email: string; password: string }): Promise<AppUser> {
  await http.post('/auth/register', input)
  try { return await login(input.email, input.password) }
  catch (error) { throw new Error('Conta criada. Entre pela tela de login. ' + errorMessage(error)) }
}
export const me = async (): Promise<AppUser> => userFromAPI(await http.get<UserDTO>('/auth/me'))
export const logout = (): Promise<void> => http.post('/auth/logout')
export const changePassword = (currentPassword: string, newPassword: string): Promise<void> =>
  http.put('/auth/password', { current_password: currentPassword, password: newPassword })
