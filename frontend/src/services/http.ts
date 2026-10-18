import { config } from '../config'
import { ApiError } from './db'

/**
 * Cliente HTTP pronto para o backend real. Ainda não é usado pelo mock:
 * quando a API existir, cada função dos services troca `simulate(...)` por uma chamada daqui,
 * por exemplo `http.get<Paged<StockLot>>('/lots', { q, page })`.
 */
type Params = Record<string, string | number | undefined>

let token: string | null = null
export const setToken = (value: string | null): void => { token = value }

async function request<T>(method: string, path: string, options: { params?: Params; body?: unknown } = {}): Promise<T> {
  const url = new URL(config.apiUrl + path, window.location.origin)
  for (const [key, value] of Object.entries(options.params ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
  }
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { message?: string } | null
    throw new ApiError(detail?.message ?? 'Não foi possível concluir a operação.', response.status)
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

export const http = {
  get: <T>(path: string, params?: Params) => request<T>('GET', path, { params }),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, { body }),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
