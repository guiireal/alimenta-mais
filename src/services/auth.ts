import { DEMO_PASSWORD } from '../data/mock'
import { passwordProblem } from '../lib/validators'
import type { AppUser } from '../types'
import { ApiError, db, logAudit, nextId, persistUsers, simulate } from './db'

/**
 * Só existe no mock. Num backend real a senha viaja por HTTPS e o servidor guarda
 * um hash lento com sal (argon2 ou bcrypt); o front nunca calcula nem guarda hash de senha.
 */
async function hashPassword(email: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${email.trim().toLowerCase()}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function login(email: string, password: string): Promise<AppUser> {
  const hash = await hashPassword(email, password)
  return simulate(() => {
    const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    const saved = user ? db.passwordHashes[user.id] : undefined
    const valid = user !== undefined && (saved ? saved === hash : password === DEMO_PASSWORD)
    if (!user || !valid) throw new ApiError('E-mail ou senha incorretos.', 401)
    if (!user.active) throw new ApiError('Usuário inativo. Fale com o gestor.', 403)
    return user
  })
}

/**
 * Autocadastro. Toda conta nova nasce como Voluntário (o menor acesso);
 * só um gestor amplia o perfil, em Acessos e auditoria.
 */
export async function register(input: { name: string; email: string; password: string }): Promise<AppUser> {
  const hash = await hashPassword(input.email, input.password)
  return simulate(() => {
    const name = input.name.trim()
    const email = input.email.trim().toLowerCase()
    if (name.length < 3 || !EMAIL.test(email) || passwordProblem(input.password)) throw new ApiError('Dados do cadastro inválidos.', 422)
    if (db.users.some((u) => u.email.toLowerCase() === email)) throw new ApiError('Já existe uma conta com este e-mail.', 409)
    const user: AppUser = { id: nextId('U', db.users.map((u) => u.id), 1), name, email, role: 'volunteer', active: true }
    db.users.push(user)
    db.passwordHashes[user.id] = hash
    persistUsers()
    logAudit('Conta criada', user.id, user.name)
    return user
  })
}

/** Restaura a sessão a partir do id guardado no navegador. */
export const me = (id: string): Promise<AppUser | null> =>
  simulate(() => db.users.find((u) => u.id === id && u.active) ?? null)
