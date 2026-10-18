import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { AsyncBoundary, Badge, Button, Card, EmptyState, LinkButton, PageHeader, TableScroll, tdClass, thClass } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useAdvanceStop, useRoutes, useSetRouteStatus } from '../hooks/queries'
import { cn, DELIVERY_META, errorMessage, formatDate } from '../lib/utils'
import { http } from '../services/http'
import type { RouteStatus } from '../types'
const ROUTE_LABEL: Record<RouteStatus, string> = { waiting: 'Aguardando', in_transit: 'Em andamento', completed: 'Concluída', cancelled: 'Cancelada' }
function Items({ id }: { id: string }) {
  const query = useQuery({ queryKey: ['delivery', id], queryFn: () => http.get<{ items: { id: number; batch_id: number; quantity: string }[] }>('/deliveries/' + id) })
  return <Card title={'Itens da entrega #' + id}><AsyncBoundary isPending={query.isPending} isError={query.isError} error={query.error} onRetry={() => void query.refetch()}><ul>{query.data?.items.map((i) => <li key={i.id}>Lote #{i.batch_id} · Quantidade: {i.quantity}</li>)}</ul></AsyncBoundary></Card>
}
export default function Deliveries() {
  const { can } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [deliveryId, setDeliveryId] = useState('')
  const routes = useRoutes()
  const advance = useAdvanceStop()
  const change = useSetRouteStatus()
  const list = routes.data ?? []
  const route = list.find((r) => r.id === params.get('rota')) ?? list[0]
  const onError = (e: unknown) => toast.error(errorMessage(e))
  const setStatus = (status: RouteStatus) => { if (route) change.mutate({ id: route.id, status }, { onSuccess: () => toast.success('Rota atualizada.'), onError }) }
  return <>
    <PageHeader title="Entregas e rotas" description="Organize as entregas, confira os produtos e acompanhe a execução." actions={can('delivery:write') && <LinkButton to="/entregas/nova">Nova rota</LinkButton>} />
    <AsyncBoundary isPending={routes.isPending} isError={routes.isError} error={routes.error} onRetry={() => void routes.refetch()}>
      {!route ? <EmptyState title="Nenhuma rota criada" description="Crie uma rota para organizar as entregas." /> : <>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Escolher rota">{list.map((r) => <button key={r.id} type="button" aria-pressed={r.id === route.id} onClick={() => { setParams({ rota: r.id }, { replace: true }); setDeliveryId('') }} className={cn('rounded-lg px-4 py-2 text-sm font-bold', r.id === route.id ? 'bg-leaf-900 text-white' : 'border border-cream-500 bg-white')}>{r.name}</button>)}</div>
        <Card title={route.name}><dl className="grid gap-3 text-sm sm:grid-cols-4">
          <div><dt>Responsável</dt><dd className="font-bold">{route.driver}</dd></div><div><dt>Origem</dt><dd className="font-bold">{route.warehouse}</dd></div>
          <div><dt>Data</dt><dd className="font-bold">{formatDate(route.scheduledOn)}</dd></div><div><dt>Situação</dt><dd><Badge>{ROUTE_LABEL[route.status]}</Badge></dd></div>
        </dl>{can('delivery:write') && <div className="mt-4 flex flex-wrap gap-2">
          {route.status === 'waiting' && <><LinkButton to={'/entregas/' + route.id + '/nova'} variant="secondary">Adicionar entrega</LinkButton><Button disabled={change.isPending} onClick={() => setStatus('in_transit')}>Iniciar rota</Button><Button variant="secondary" disabled={change.isPending} onClick={() => setStatus('cancelled')}>Cancelar rota</Button></>}
          {route.status === 'in_transit' && <Button disabled={change.isPending} onClick={() => setStatus('completed')}>Concluir rota</Button>}
        </div>}</Card>
        <Card title="Paradas"><TableScroll><thead><tr><th className={thClass}>Ordem</th><th className={thClass}>Destino</th><th className={thClass}>Situação</th><th className={thClass}>Ações</th></tr></thead>
          <tbody>{route.stops.map((s) => <tr key={s.id}><td className={tdClass}>{s.order}</td><td className={tdClass}>{s.destination}</td><td className={tdClass}><Badge tone={DELIVERY_META[s.status].tone}>{DELIVERY_META[s.status].label}</Badge></td>
            <td className={tdClass}><div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => setDeliveryId(s.id)}>Ver itens</Button>
              {can('delivery:write') && route.status === 'in_transit' && (s.status === 'waiting' || s.status === 'en_route') && <Button variant="secondary" disabled={advance.isPending} onClick={() => advance.mutate({ routeId: route.id, stopId: s.id, status: s.status as 'waiting' | 'en_route' }, { onSuccess: () => toast.success('Entrega atualizada.'), onError })}>{s.status === 'waiting' ? 'Iniciar entrega' : 'Confirmar entrega'}</Button>}
            </div></td></tr>)}</tbody>
        </TableScroll>{route.stops.length === 0 && <p className="py-4 text-sm">Nenhuma entrega adicionada.</p>}</Card>
        {deliveryId && <Items key={deliveryId} id={deliveryId} />}
      </>}
    </AsyncBoundary>
  </>
}
