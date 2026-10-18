import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { can as roleCan } from '../lib/permissions'
import * as authService from '../services/auth'
import { ApiError } from '../services/errors'
import { SESSION_EXPIRED } from '../services/http'
import type { AppUser, Permission } from '../types'

interface AuthApi {
  user: AppUser | null
  loading: boolean
  error: unknown
  retry: () => void
  login: (email: string, password: string) => Promise<void>
  register: (input: { name: string; email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
  can: (permission: Permission) => boolean
}
const AuthContext = createContext<AuthApi | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)
  const channel = useRef<BroadcastChannel>()
  const revision = useRef(0)
  const clear = useCallback(() => { revision.current++; setUser(null); queryClient.clear() }, [queryClient])

  useEffect(() => {
    let cancelled = false
    const version = revision.current
    setLoading(true)
    setError(null)
    authService.me()
      .then((found) => { if (!cancelled && version === revision.current) setUser(found) })
      .catch((cause: unknown) => {
        if (cancelled || version !== revision.current) return
        if (cause instanceof ApiError && cause.status === 401) clear()
        else setError(cause)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [attempt, clear])

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED, clear)
    return () => window.removeEventListener(SESSION_EXPIRED, clear)
  }, [clear])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const connection = new BroadcastChannel('alimenta:auth')
    channel.current = connection
    connection.onmessage = (event: MessageEvent<unknown>) => {
      clear()
      setError(null)
      if (event.data === 'login') setAttempt((n) => n + 1)
    }
    return () => { channel.current = undefined; connection.close() }
  }, [clear])

  const login = useCallback(async (email: string, password: string) => {
    const found = await authService.login(email, password)
    queryClient.clear()
    setError(null)
    setUser(found)
    channel.current?.postMessage('login')
  }, [queryClient])
  const register = useCallback(async (input: { name: string; email: string; password: string }) => {
    const found = await authService.register(input)
    queryClient.clear()
    setError(null)
    setUser(found)
    channel.current?.postMessage('login')
  }, [queryClient])
  const logout = useCallback(async () => { await authService.logout(); clear(); channel.current?.postMessage('logout') }, [clear])
  const value = useMemo<AuthApi>(() => ({
    user, loading, error, retry: () => setAttempt((n) => n + 1), login, register, logout,
    can: (permission) => roleCan(user?.role, permission),
  }), [user, loading, error, login, register, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}
