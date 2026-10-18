import { useParams } from 'react-router-dom'
import { AsyncBoundary, Badge, BackLink, Card, EmptyRow, PageHeader, Skeleton, StatStrip, TableScroll, tdClass, thClass } from '../components/ui'
import { useDonor } from '../hooks/queries'
import { formatDate, formatNumber } from '../lib/utils'

export default function DonorDetail() {
  const { id = '' } = useParams()
  const query = useDonor(id)
  const data = query.data

  return (
    <>
      <BackLink to="/doadores">Voltar aos doadores</BackLink>
      <AsyncBoundary isPending={query.isPending} isError={query.isError} error={query.error} onRetry={() => void query.refetch()} skeleton={<Skeleton className="h-64" />}>
        {data && (
          <>
            <PageHeader title={data.donor.name} description={[data.donor.email, data.donor.phone].filter(Boolean).join(', ') || 'Sem contato registrado'} actions={<Badge tone={data.donor.type === 'PJ' ? 'orange' : 'neutral'}>{data.donor.type === 'PJ' ? 'Empresa' : 'Pessoa física'}</Badge>} />
            <StatStrip stats={[
              { label: 'Total doado', value: `${formatNumber(data.donor.totalKg)} kg` },
              { label: 'Doações', value: String(data.donor.donationsCount) },
              { label: 'Última doação', value: data.donor.lastDonationAt ? formatDate(data.donor.lastDonationAt) : 'Nenhuma' },
            ]} />
            <Card title="Doações registradas">
              <TableScroll minWidth="min-w-[480px]">
                <thead><tr><th className={thClass}>Número</th><th className={thClass}>Data</th><th className={thClass}>Peso</th></tr></thead>
                <tbody>
                  {data.donations.length === 0 && <EmptyRow colSpan={3}>Este doador ainda não tem doações registradas.</EmptyRow>}
                  {data.donations.map((d) => (
                    <tr key={d.id}><td className={`${tdClass} font-semibold`}>{d.id}</td><td className={tdClass}>{formatDate(d.receivedAt)}</td><td className={tdClass}>{d.weightKg} kg</td></tr>
                  ))}
                </tbody>
              </TableScroll>
            </Card>
          </>
        )}
      </AsyncBoundary>
    </>
  )
}
