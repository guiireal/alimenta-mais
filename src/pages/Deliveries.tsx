import { Plus } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { AsyncBoundary, Badge, Button, Card, EmptyState, LinkButton, PageHeader, Skeleton, TableScroll, tdClass, thClass } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useAdvanceStop, useRoutes } from '../hooks/queries'
import { cn, DELIVERY_META, errorMessage } from '../lib/utils'
import type { DeliveryStatus } from '../types'

const ACTION_LABEL: Record<DeliveryStatus, string | null> = { waiting: 'Iniciar entrega', en_route: 'Confirmar entrega', delivered: null }

export default function Deliveries() {
  const { can } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const routes = useRoutes()
  const advance = useAdvanceStop()

  const list = routes.data ?? []
  const route = list.find((r) => r.id === params.get('rota')) ?? list[0]

  const onAdvance = (routeId: string, stopId: string, status: DeliveryStatus) =>
    advance.mutate({ routeId, stopId }, {
      onSuccess: () => toast.success(status === 'en_route' ? 'Entrega confirmada.' : 'Entrega iniciada.'),
      onError: (e) => toast.error(errorMessage(e)),
    })

  return (
    <>
      <PageHeader
        title="Entregas e rotas"
        description="Acompanhe as paradas do dia e gere novas rotas para as famílias com consentimento."
        actions={can('delivery:write') && <LinkButton to="/entregas/nova"><Plus size={16} aria-hidden="true" />Nova rota</LinkButton>}
      />

      <AsyncBoundary isPending={routes.isPending} isError={routes.isError} error={routes.error} onRetry={() => void routes.refetch()} skeleton={<Skeleton className="h-96" />}>
        {!route ? (
          <EmptyState title="Nenhuma rota criada" description="Crie uma rota para organizar as entregas do dia." />
        ) : (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Escolher rota">
              {list.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={r.id === route.id}
                  onClick={() => setParams({ rota: r.id }, { replace: true })}
                  className={cn('h-10 rounded-lg px-4 text-sm font-bold transition-colors', r.id === route.id ? 'bg-leaf-900 text-white' : 'border border-cream-500 bg-white hover:bg-cream-100')}
                >
                  {r.name}
                </button>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              <Card title="Mapa da rota" className="lg:col-span-3">
                <div className="relative aspect-[16/11] overflow-hidden rounded-lg border border-dashed border-cream-300 bg-cream-100">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
                    <polyline points={[route.depot, ...route.stops].map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#f28c28" strokeWidth="2.5" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
                  </svg>
                  <span className="absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-leaf-900 text-xs font-extrabold text-white" style={{ left: `${route.depot.x}%`, top: `${route.depot.y}%` }} title="Depósito">D</span>
                  {route.stops.map((s) => (
                    <span key={s.id} title={`${s.order}. ${s.destination}`} className={cn('absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-xs font-extrabold', DELIVERY_META[s.status].pin)} style={{ left: `${s.x}%`, top: `${s.y}%` }}>{s.order}</span>
                  ))}
                </div>
                <p className="mt-3 text-sm text-ink-600">Mapa ilustrativo. Na versão integrada, a rota virá de um serviço de mapas.</p>
              </Card>

              <Card title="Detalhes da rota" className="lg:col-span-2">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-ink-600">Equipe</dt><dd className="font-bold">{route.driver}</dd></div>
                  <div><dt className="text-ink-600">Veículo</dt><dd className="font-bold">{route.vehicle}</dd></div>
                  <div><dt className="text-ink-600">Paradas</dt><dd className="font-bold">{route.stops.length}</dd></div>
                  <div><dt className="text-ink-600">Entregues</dt><dd className="font-bold">{route.stops.filter((s) => s.status === 'delivered').length}</dd></div>
                </dl>
              </Card>
            </div>

            <Card title="Paradas">
              <TableScroll minWidth="min-w-[640px]">
                <thead>
                  <tr>
                    <th className={thClass}>Ordem</th><th className={thClass}>Destino</th><th className={thClass}>Itens</th><th className={thClass}>Previsão</th><th className={thClass}>Situação</th>
                    {can('delivery:write') && <th className={thClass}><span className="sr-only">Ação</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {route.stops.map((s) => {
                    const label = ACTION_LABEL[s.status]
                    return (
                      <tr key={s.id}>
                        <td className={`${tdClass} font-semibold`}>{s.order}</td>
                        <td className={tdClass}>{s.destination}</td>
                        <td className={tdClass}>{s.items}</td>
                        <td className={tdClass}>{s.eta}</td>
                        <td className={tdClass}><Badge tone={DELIVERY_META[s.status].tone}>{DELIVERY_META[s.status].label}</Badge></td>
                        {can('delivery:write') && (
                          <td className={tdClass}>
                            {label && (
                              <Button variant="secondary" className="h-8 px-3 text-xs" disabled={advance.isPending && advance.variables?.stopId === s.id} onClick={() => onAdvance(route.id, s.id, s.status)}>
                                {label}
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </TableScroll>
            </Card>
          </>
        )}
      </AsyncBoundary>
    </>
  )
}
