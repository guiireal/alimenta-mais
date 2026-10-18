import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AsyncBoundary, Badge, Card, controlClass, EmptyState, LinkButton, PageHeader, Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useDonors } from '../hooks/queries'
import { useDebouncedValue } from '../lib/hooks'
import { formatDate, formatNumber } from '../lib/utils'

export default function Donors() {
  const { can } = useAuth()
  const [text, setText] = useState('')
  const donors = useDonors(useDebouncedValue(text, 300))

  return (
    <>
      <PageHeader
        title="Doadores"
        description="Empresas e pessoas que doam alimentos, com o histórico de cada uma."
        actions={can('donor:write') && <LinkButton to="/doadores/novo"><Plus size={16} aria-hidden="true" />Novo doador</LinkButton>}
      />
      <label className="relative block max-w-sm">
        <span className="sr-only">Buscar doador</span>
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-600" aria-hidden="true" />
        <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar doador" className={`${controlClass} pl-9`} />
      </label>

      <AsyncBoundary isPending={donors.isPending} isError={donors.isError} error={donors.error} onRetry={() => void donors.refetch()} skeleton={<Skeleton className="h-48" />}>
        {donors.data?.length === 0 ? (
          <EmptyState title="Nenhum doador encontrado" description="Tente outro nome ou cadastre um novo doador." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {donors.data?.map((d) => (
              <li key={d.id}>
                <Card className="h-full">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-bold"><Link to={`/doadores/${d.id}`} className="hover:underline">{d.name}</Link></h2>
                    <Badge tone={d.type === 'PJ' ? 'orange' : 'neutral'}>{d.type === 'PJ' ? 'Empresa' : 'Pessoa física'}</Badge>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div><dt className="text-ink-600">Total doado</dt><dd className="font-extrabold">{formatNumber(d.totalKg)} kg</dd></div>
                    <div><dt className="text-ink-600">Doações</dt><dd className="font-extrabold">{d.donationsCount}</dd></div>
                    <div><dt className="text-ink-600">Última</dt><dd className="font-extrabold">{d.lastDonationAt ? formatDate(d.lastDonationAt) : 'Nenhuma'}</dd></div>
                  </dl>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </AsyncBoundary>
    </>
  )
}
