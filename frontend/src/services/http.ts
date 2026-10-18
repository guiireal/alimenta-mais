import { config } from '../config'
import { ApiError } from './errors'

type Params = Record<string, string | number | boolean | undefined>
type Options = { params?: Params; body?: unknown }
export const SESSION_EXPIRED = 'alimenta:session-expired'

const csrf = () => document.cookie.split('; ').find((part) => part.startsWith('alimenta_csrf='))?.slice('alimenta_csrf='.length) ?? ''

async function send(method: string, path: string, options: Options = {}): Promise<Response> {
  const url = new URL(config.apiUrl + path, window.location.origin)
  for (const [key, value] of Object.entries(options.params ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
  }
  return fetch(url, {
    method, credentials: 'include', cache: 'no-store',
    headers: {
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) ? { 'X-CSRF-Token': csrf() } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
}

async function result<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { message?: string; fields?: Record<string, string> } | null
    throw new ApiError(detail?.message ?? 'Não foi possível concluir a operação.', response.status, detail?.fields)
  }
  return response.status === 204 ? undefined as T : await response.json() as T
}

let renewal: Promise<void> | undefined
export function refreshSession(): Promise<void> {
  if (!renewal) {
    const renew = async () => {
      // Another tab may have renewed the shared cookies while this tab waited for the lock.
      const current = await send('GET', '/auth/me')
      if (current.ok) return
      if (current.status !== 401) await result(current)
      await result(await send('POST', '/auth/refresh'))
    }
    // shortcut: older browsers without Web Locks coordinate only this tab; concurrent tabs may need to sign in again.
    renewal = (navigator.locks ? navigator.locks.request('alimenta:refresh', renew) : renew())
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) window.dispatchEvent(new Event(SESSION_EXPIRED))
        throw error
      })
      .finally(() => { renewal = undefined })
  }
  return renewal
}

async function request<T>(method: string, path: string, options: Options = {}): Promise<T> {
  let response = await send(method, path, options)
  if (response.status === 401 && !['/auth/login', '/auth/register', '/auth/refresh'].includes(path)) {
    await refreshSession()
    response = await send(method, path, options)
    if (response.status === 401) window.dispatchEvent(new Event(SESSION_EXPIRED))
  }
  return result<T>(response)
}

export const http = {
  get: <T>(path: string, params?: Params) => request<T>('GET', path, { params }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

export interface Page<T> { items: T[]; total: number; page: number; page_size: number }
export async function allPages<T>(path: string, params: Params = {}): Promise<T[]> {
  const items: T[] = []
  for (let page = 1; ; page++) {
    const data = await http.get<Page<T>>(path, { ...params, page, page_size: 100 })
    items.push(...data.items)
    if (data.items.length === 0 || items.length >= data.total) return items
  }
}
