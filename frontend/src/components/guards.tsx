import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Permission } from '../types'
import Forbidden from '../pages/Forbidden'

/** Só entra quem estiver logado; guarda a rota de origem para voltar depois do login. */
export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p className="p-6 text-sm text-ink-600" role="status">Carregando…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

/** Bloqueia a rota para perfis sem a permissão. O backend precisa repetir essa checagem. */
export function RequirePermission({ permission }: { permission: Permission }) {
  const { can } = useAuth()
  return can(permission) ? <Outlet /> : <Forbidden />
}
