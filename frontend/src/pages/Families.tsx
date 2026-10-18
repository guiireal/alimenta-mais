import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AsyncBoundary, Badge, Card, controlClass, EmptyRow, LinkButton, PageHeader, Skeleton, TableScroll, tdClass, thClass } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useFamilies } from '../hooks/queries'
import { useDebouncedValue } from '../lib/hooks'
import { formatDate } from '../lib/utils'
import type { ConsentStatus } from '../types'

export default function Families() {
  const { can } = useAuth()
  const [text, setText] = useState('')
  const [consent, setConsent] = useState<ConsentStatus | 'all'>('all')
  const families = useFamilies({ q: useDebouncedValue(text, 300), consent })

  return (
    <>
      <PageHeader
        title="Famílias atendidas"
        description="A lista mostra apenas o código da família. Dados pessoais ficam restritos a perfis autorizados (LGPD)."
        actions={can('family:write') && <LinkButton to="/familias/nova"><Plus size={16} aria-hidden="true" />Cadastrar família</LinkButton>}
      />
      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="relative">
            <span className="sr-only">Buscar por código ou bairro</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-600" aria-hidden="true" />
            <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Buscar por código ou bairro" className={`${controlClass} pl-9`} />
          </label>
          <select aria-label="Consentimento LGPD" value={consent} onChange={(e) => setConsent(e.target.value as ConsentStatus | 'all')} className={controlClass}>
            <option value="all">Todos os consentimentos</option>
            <option value="granted">Consentimento ok</option>
            <option value="pending">Pendente</option>
          </select>
        </div>

        <AsyncBoundary isPending={families.isPending} isError={families.isError} error={families.error} onRetry={() => void families.refetch()} skeleton={<Skeleton className="h-60" />}>
          <TableScroll minWidth="min-w-[560px]">
            <thead>
              <tr>
                <th className={thClass}>Código</th><th className={thClass}>Bairro</th><th className={thClass}>Pessoas</th>
                <th className={thClass}>Consentimento LGPD</th><th className={`${thClass} hidden sm:table-cell`}>Última entrega</th>
              </tr>
            </thead>
            <tbody>
              {families.data?.length === 0 && <EmptyRow colSpan={5}>Nenhuma família encontrada.</EmptyRow>}
              {families.data?.map((f) => (
                <tr key={f.id}>
                  <td className={tdClass}><Link to={`/familias/${f.id}`} className="font-semibold text-leaf-800 hover:underline">{f.code}</Link></td>
                  <td className={tdClass}>{f.neighborhood}</td>
                  <td className={tdClass}>{f.members}</td>
                  <td className={tdClass}><Badge tone={f.consent === 'granted' ? 'green' : 'orange'}>{f.consent === 'granted' ? 'Consentimento ok' : 'Pendente'}</Badge></td>
                  <td className={`${tdClass} hidden sm:table-cell`}>{f.lastDeliveryAt ? formatDate(f.lastDeliveryAt) : 'Sem entregas'}</td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        </AsyncBoundary>
      </Card>
    </>
  )
}
