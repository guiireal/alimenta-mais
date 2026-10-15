import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { config } from '../config'
import { can as roleCan } from '../lib/permissions'
import * as authService from '../services/auth'
import { setActor } from '../services/db'
import type { AppUser, Permission } from '../types'

interface AuthApi {
  user: AppUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: { name: string; email: string; password: string }) => Promise<void>
  logout: () => void
  can: (permission: Permission) => boolean
}

const AuthContext = createContext<AuthApi | null>(null)

// o acesso ao localStorage pode falhar (modo privado, política do navegador)
const readSession = (): string | null => { try { return localStorage.getItem(config.sessionKey) } catch { return null } }
const writeSession = (id: string | null): void => {
  try { id ? localStorage.setItem(config.sessionKey, id) : localStorage.removeItem(config.sessionKey) } catch { /* sem persistência */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = readSession()
    if (!id) { setLoading(false); return }
    let cancelled = false
    authService.me(id)
      .then((found) => { if (!cancelled) setUser(found) })
      .catch(() => { if (!cancelled) setUser(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => { setActor(user?.name ?? 'Sistema') }, [user])

  const login = useCallback(async (email: string, password: string) => {
    const found = await authService.login(email, password)
    writeSession(found.id)
    setUser(found)
  }, [])

  /** Cria a conta e já entra com ela. */
  const register = useCallback(async (input: { name: string; email: string; password: string }) => {
    const created = await authService.register(input)
    writeSession(created.id)
    setUser(created)
  }, [])

  const logout = useCallback(() => {
    writeSession(null)
    setUser(null)
    queryClient.clear() // nada do usuário anterior deve sobrar no cache
  }, [queryClient])

  const value = useMemo<AuthApi>(
    () => ({ user, loading, login, register, logout, can: (p) => roleCan(user?.role, p) }),
    [user, loading, login, register, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}
