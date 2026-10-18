import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { BarChart3, Boxes, Building2, HandHeart, LayoutDashboard, LogOut, Menu, Search, ShieldCheck, Truck, Users, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/utils'
import { ROLE_LABEL } from '../../lib/permissions'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../lib/utils'
import type { Permission } from '../../types'
import { ErrorBoundary } from '../ErrorBoundary'
import { NotificationsMenu } from '../NotificationsMenu'
import { SearchForm } from '../SearchForm'
import { Skeleton } from '../ui'

interface NavItem { to: string; label: string; icon: LucideIcon; permission?: Permission }

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'report:read' },
  { to: '/cadastros', label: 'Cadastros', icon: Building2, permission: 'stock:write' },
  { to: '/doacoes', label: 'Doações', icon: HandHeart, permission: 'donation:read' },
  { to: '/estoque', label: 'Estoque e Validade', icon: Boxes, permission: 'stock:read' },
  { to: '/familias', label: 'Famílias', icon: Users, permission: 'family:read' },
  { to: '/entregas', label: 'Entregas e Rotas', icon: Truck, permission: 'delivery:read' },
  { to: '/doadores', label: 'Doadores', icon: Building2, permission: 'donor:read' },
  { to: '/relatorios', label: 'Relatórios BI', icon: BarChart3, permission: 'report:read' },
  { to: '/acessos', label: 'Acessos e Auditoria', icon: ShieldCheck, permission: 'access:read' },
]

export default function AppShell() {
  const { user, logout, can } = useAuth()
  const toast = useToast()
  const [signingOut, setSigningOut] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  const items = NAV.filter((n) => !n.permission || can(n.permission))
  const current = items.find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)))

  // a cada troca de tela: fecha o menu, volta ao topo e leva o foco ao conteúdo (leitores de tela)
  useEffect(() => {
    setOpen(false)
    window.scrollTo(0, 0)
    mainRef.current?.focus()
  }, [pathname])

  useEffect(() => {
    window.document.title = current ? `${current.label} | Alimenta+` : 'Alimenta+'
  }, [current])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="min-h-dvh lg:pl-64">
      <a href="#conteudo" className="sr-only rounded-lg bg-white px-3 py-2 font-bold focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50">
        Ir para o conteúdo
      </a>

      {open && <div className="fixed inset-0 z-30 bg-ink-900/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside
        id="menu-principal"
        className={cn('fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-leaf-900 p-4 text-white transition-transform duration-200 lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}
      >
        <div className="mb-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-extrabold" aria-label="Alimenta+, ir para o início">
            <span className="grid size-8 place-items-center rounded-full bg-carrot-500 text-ink-900"><HandHeart size={18} aria-hidden="true" /></span>
            Alimenta+
          </Link>
          <button type="button" className="rounded-lg p-2 hover:bg-leaf-800 lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
        </div>

        <nav aria-label="Principal" className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors', isActive ? 'bg-carrot-500 text-ink-900' : 'text-leaf-100 hover:bg-leaf-800')}
            >
              <Icon size={18} aria-hidden="true" />{label}
            </NavLink>
          ))}
        </nav>

        {user && (
          <div className="mt-4 border-t border-leaf-800 pt-4">
            <p className="truncate text-sm font-bold">{user.name}</p>
            <p className="text-xs text-leaf-100">{ROLE_LABEL[user.role]}</p>
            <button
              type="button"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true)
                try { await logout(); navigate('/login') }
                catch (error) { toast.error(errorMessage(error)) }
                finally { setSigningOut(false) }
              }}
              className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-leaf-100 hover:bg-leaf-800"
            >
              <LogOut size={16} aria-hidden="true" />Sair
            </button>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-col">
        <div className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-cream-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button type="button" className="rounded-lg p-2 hover:bg-cream-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open} aria-controls="menu-principal">
            <Menu size={22} />
          </button>
          <Link to="/" className="text-lg font-extrabold text-leaf-900 lg:hidden" aria-label="Alimenta+, ir para o início">Alimenta+</Link>

          <SearchForm className="ml-auto hidden w-full max-w-sm md:block" />

          <Link to="/busca" aria-label="Buscar" className="ml-auto rounded-lg p-2 hover:bg-cream-100 md:hidden"><Search size={20} /></Link>
          <NotificationsMenu />
        </div>

        <main id="conteudo" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-7xl space-y-5 p-4 outline-none sm:p-6">
          <ErrorBoundary key={pathname}>
            <Suspense fallback={<Skeleton className="h-64" />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
