import { Link, Navigate } from 'react-router-dom'
import { BarChart } from '../components/BarChart'
import { ExpiryBadge } from '../components/ExpiryBadge'
import { ShelfLife } from '../components/ShelfLife'
import { AsyncBoundary, Card, PageHeader, Skeleton, StatStrip } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../hooks/queries'
import { daysLabel, formatNumber } from '../lib/utils'

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-24" />
      <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-72 lg:col-span-2" /><Skeleton className="h-72" /></div>
    </div>
  )
}

export default function Dashboard() {
  const { can } = useAuth()
  const dash = useDashboard(can('report:read'))
  const data = dash.data
  const maxLoss = Math.max(1, ...data?.loss.map((l) => l.kg) ?? [])
  if (!can('report:read')) return <Navigate to="/estoque" replace />

  return (
    <>
      <PageHeader title="Visão geral" description="Acompanhe doações, estoque e entregas do banco de alimentos." />
      <AsyncBoundary isPending={dash.isPending} isError={dash.isError} error={dash.error} onRetry={() => void dash.refetch()} skeleton={<DashboardSkeleton />}>
        {data && (
          <>
            <StatStrip
              stats={[
                { label: 'Volume doado no período', value: `${formatNumber(data.kpis.donatedKg)} kg` },
                { label: 'Rotatividade do estoque', value: `${data.kpis.turnover.toLocaleString('pt-BR')}x` },
                { label: 'Tempo médio de entrega', value: `${data.kpis.avgDeliveryHours.toLocaleString('pt-BR')} h` },
                { label: 'Cobertura de famílias', value: `${data.kpis.coveragePct}%` },
              ]}
            />

            <div className="grid gap-4 lg:grid-cols-3">
              <Card title="Doações e distribuição" className="lg:col-span-2"><BarChart data={data.monthly} /></Card>
              <Card title="Validades mais próximas" action={<Link to="/estoque" className="text-sm font-bold text-leaf-700 hover:underline">Ver estoque</Link>}>
                <ul className="space-y-4">
                  {data.expiring.map((lot) => (
                    <li key={lot.id}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link to={`/estoque/${lot.id}`} className="font-semibold hover:underline">{lot.item}</Link>
                          <p className="text-xs text-ink-600">Lote {lot.id}, {daysLabel(lot.expiresAt)}</p>
                        </div>
                        <ExpiryBadge expiresAt={lot.expiresAt} />
                      </div>
                      <ShelfLife expiresAt={lot.expiresAt} className="mt-2" />
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Perdas por categoria (kg no período)">
                <ul className="space-y-3">
                  {data.loss.map((l) => (
                    <li key={l.category} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-3 text-sm">
                      <span>{l.category}</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-cream-100"><span className="block h-full rounded-full bg-tomato-600" style={{ width: `${(l.kg / maxLoss) * 100}%` }} /></span>
                      <span className="text-right font-semibold">{l.kg}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card title="Resumo de rotas" action={can('delivery:read') ? <Link to="/entregas" className="text-sm font-bold text-leaf-700 hover:underline">Ver rotas</Link> : undefined}>
                <ul className="space-y-4">
                  {data.routes.map((r) => (
                    <li key={r.id}>
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold">{r.name}</span>
                        <span className="text-ink-600">{r.done} de {r.total} entregues</span>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-cream-100" role="img" aria-label={`${r.done} de ${r.total} paradas entregues`}>
                        <div className="h-full rounded-full bg-leaf-600" style={{ width: `${(r.done / Math.max(1, r.total)) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </>
        )}
      </AsyncBoundary>
    </>
  )
}
