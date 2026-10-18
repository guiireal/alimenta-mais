import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { login, me, register } from './auth'
import { http, SESSION_EXPIRED } from './http'

const user = { id: 1, name: 'Admin', email: 'admin@example.test', role: 'administrator', is_active: true }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const fetcher = vi.fn<typeof fetch>()
let events: EventTarget
beforeEach(() => {
  events = new EventTarget()
  vi.stubGlobal('window', Object.assign(events, { location: { origin: 'http://localhost:5173' } }))
  vi.stubGlobal('document', { cookie: 'alimenta_csrf=csrf-secret' })
  vi.stubGlobal('navigator', {})
  vi.stubGlobal('fetch', fetcher)
  fetcher.mockReset()
})
afterEach(() => vi.unstubAllGlobals())

describe('API authentication', () => {
  it('logs in using cookies and restores the server user without localStorage', async () => {
    fetcher.mockResolvedValueOnce(json({ user, expires_at: '2030-01-01T00:00:00Z' })).mockResolvedValueOnce(json(user))
    expect(await login(user.email, 'Secret1234')).toMatchObject({ id: '1', role: 'administrator', active: true })
    expect(await me()).toMatchObject({ id: '1' })
    const options = fetcher.mock.calls[0][1]!
    expect(options.credentials).toBe('include')
    expect(options.headers).not.toHaveProperty('Authorization')
    expect(JSON.parse(options.body as string)).toEqual({ email: user.email, password: 'Secret1234' })
  })
  it('does not refresh or repeat incorrect credentials', async () => {
    fetcher.mockResolvedValueOnce(json({ message: 'Credenciais inválidas' }, 401))
    await expect(login('bad@example.test', 'wrong')).rejects.toMatchObject({ status: 401 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('registers through the API and authenticates the new operator', async () => {
    fetcher.mockResolvedValueOnce(json(user, 201)).mockResolvedValueOnce(json({ user: { ...user, role: 'operator' } }))
    expect((await register({ name: 'New User', email: 'new@example.test', password: 'Secret1234' })).role).toBe('operator')
    expect(String(fetcher.mock.calls[0][0])).toContain('/api/auth/register')
    expect(String(fetcher.mock.calls[1][0])).toContain('/api/auth/login')
  })
  it('shares one refresh and retries simultaneous expired requests only once, using the current CSRF cookie', async () => {
    let refreshed = false
    fetcher.mockImplementation(async (url, options) => {
      const path = new URL(String(url)).pathname
      if (path.endsWith('/auth/me')) return json({}, 401)
      if (path.endsWith('/auth/refresh')) {
        await Promise.resolve()
        refreshed = true
        return json({ user })
      }
      if (!refreshed) return json({}, 401)
      expect((options!.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-secret')
      return json({ saved: true })
    })
    expect(await Promise.all([http.post('/a', { value: '1.001' }), http.post('/b', {})])).toEqual([{ saved: true }, { saved: true }])
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(1)
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/a'))).toHaveLength(2)
  })
  it('reports an account created even if its subsequent login fails', async () => {
    fetcher.mockResolvedValueOnce(json(user, 201)).mockResolvedValueOnce(json({ message: 'Temporariamente indisponível' }, 503))
    await expect(register({ name: 'New User', email: 'new@example.test', password: 'Secret1234' })).rejects.toThrow('Conta criada. Entre pela tela de login.')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('uses the cross-tab lock and avoids rotating a session already renewed by another tab', async () => {
    const lock = vi.fn(async (_key: string, callback: () => Promise<void>) => callback())
    vi.stubGlobal('navigator', { locks: { request: lock } })
    fetcher.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json(user)).mockResolvedValueOnce(json({ ok: true }))
    expect(await http.get('/stock/stats')).toEqual({ ok: true })
    expect(lock).toHaveBeenCalledOnce()
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('/auth/refresh'))).toBe(false)
  })
  it('expires local auth state when the refresh session is invalid', async () => {
    const expired = vi.fn()
    events.addEventListener(SESSION_EXPIRED, expired)
    fetcher.mockResolvedValue(json({}, 401))
    await expect(http.get('/stock/stats')).rejects.toMatchObject({ status: 401 })
    expect(expired).toHaveBeenCalledOnce()
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
  it('preserves errors and does not repeat writes or log out on server/network errors', async () => {
    const expired = vi.fn()
    events.addEventListener(SESSION_EXPIRED, expired)
    fetcher.mockResolvedValueOnce(json({ message: 'Negado', fields: { quantity: 'Inválida' } }, 403))
    await expect(http.post('/batches', {})).rejects.toMatchObject({ status: 403, fields: { quantity: 'Inválida' } })
    expect(fetcher).toHaveBeenCalledTimes(1)
    fetcher.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({}, 503))
    await expect(http.get('/stock/stats')).rejects.toMatchObject({ status: 503 })
    expect(expired).not.toHaveBeenCalled()
  })
})
