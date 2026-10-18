import { describe, expect, it } from 'vitest'
import { login, me, register } from './auth'
import { db } from './db'

const failsWith = async (promise: Promise<unknown>, status: number) =>
  promise.then(() => false, (e: { status?: number }) => e.status === status)

describe('contas (mock)', () => {
  it('perfil de demonstração entra com a senha de demonstração', async () => {
    expect((await login('ana@alimenta.example', 'alimenta123')).role).toBe('manager')
  })

  it('cria conta como voluntário, guarda só o hash e já permite entrar', async () => {
    const user = await register({ name: 'Maria Teste', email: 'Maria@Teste.com', password: 'senha1234' })
    expect(user.role).toBe('volunteer')
    expect(user.email).toBe('maria@teste.com')
    expect(db.passwordHashes[user.id]).toHaveLength(64)
    expect(db.passwordHashes[user.id] === 'senha1234').toBe(false)
    expect((await login('maria@teste.com', 'senha1234')).id).toBe(user.id)
    // a senha de demonstração não vale para contas criadas
    expect(await failsWith(login('maria@teste.com', 'alimenta123'), 401)).toBe(true)
    expect((await me(user.id))?.name).toBe('Maria Teste')
    expect(db.audit[0].action).toBe('Conta criada')
  })

  it('recusa e-mail repetido, senha fraca e nome curto', async () => {
    expect(await failsWith(register({ name: 'Ana Souza', email: 'ana@alimenta.example', password: 'senha1234' }), 409)).toBe(true)
    expect(await failsWith(register({ name: 'Novo Usuario', email: 'novo@teste.com', password: 'curta' }), 422)).toBe(true)
    expect(await failsWith(register({ name: 'No', email: 'novo@teste.com', password: 'senha1234' }), 422)).toBe(true)
  })
})
