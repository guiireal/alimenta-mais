import { useMemo, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ExpiryBadge } from '../components/ExpiryBadge'
import { SearchForm } from '../components/SearchForm'
import { BackLink, Badge, Card, EmptyState, ErrorState, Highlight, PageHeader, Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useSearch } from '../hooks/queries'
import { errorMessage, formatDate } from '../lib/utils'
import { MIN_QUERY_LENGTH } from '../services/search'

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null
  return (
    <Card title={`${title} (${count})`}>
      <ul className="divide-y divide-cream-100">{children}</ul>
    </Card>
  )
}
const rowClass = 'flex flex-wrap items-center justify-between gap-2 py-3 text-sm'

export default function Search() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const { can } = useAuth()
  const scope = useMemo(
    () => ({ stock: can('stock:read'), donors: can('donor:read'), families: can('family:read'), donations: can('donation:read') }),
    [can],
  )
  const search = useSearch(q, scope)
  const tooShort = q.trim().length < MIN_QUERY_LENGTH
  const r = search.data
  const total = r ? r.lots.length + r.donors.length + r.families.length + r.donations.length : 0

  return (
    <>
      <BackLink to="/">Voltar ao início</BackLink>
      <PageHeader title="Busca" description="Procure por item, lote, doador, código de família ou número de doação." />
      <SearchForm key={q} defaultValue={q} className="max-w-xl" autoFocus={!q} />

      {tooShort && <EmptyState title={q ? `Digite ao menos ${MIN_QUERY_LENGTH} letras` : 'O que você procura?'} description="Os resultados aparecem agrupados por tipo e respeitam o seu perfil de acesso." />}
      {!tooShort && search.isLoading && <div className="space-y-3" aria-busy="true"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>}
      {!tooShort && search.isError && <ErrorState message={errorMessage(search.error)} onRetry={() => void search.refetch()} />}

      {!tooShort && r && (
        total === 0 ? (
          <EmptyState title={`Nada encontrado para “${q}”`} description="Confira a grafia ou procure por parte do nome, como “leite” ou “vila”." />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-600" role="status">{total} {total === 1 ? 'resultado' : 'resultados'} para “{q}”</p>
            <Group title="Estoque" count={r.lots.length}>
              {r.lots.map((l) => (
                <li key={l.id} className={rowClass}>
                  <div><Link to={`/estoque/${l.id}`} className="font-bold hover:underline"><Highlight text={l.item} query={q} /></Link><p className="text-xs text-ink-600">Lote <Highlight text={l.id} query={q} />, {l.category}</p></div>
                  <ExpiryBadge expiresAt={l.expiresAt} />
                </li>
              ))}
            </Group>
            <Group title="Doadores" count={r.donors.length}>
              {r.donors.map((d) => (
                <li key={d.id} className={rowClass}>
                  <Link to={`/doadores/${d.id}`} className="font-bold hover:underline"><Highlight text={d.name} query={q} /></Link>
                  <Badge tone={d.type === 'PJ' ? 'orange' : 'neutral'}>{d.type === 'PJ' ? 'Empresa' : 'Pessoa física'}</Badge>
                </li>
              ))}
            </Group>
            <Group title="Famílias" count={r.families.length}>
              {r.families.map((f) => (
                <li key={f.id} className={rowClass}>
                  <div><Link to={`/familias/${f.id}`} className="font-bold hover:underline"><Highlight text={f.code} query={q} /></Link><p className="text-xs text-ink-600"><Highlight text={f.neighborhood} query={q} /></p></div>
                  <Badge tone={f.consent === 'granted' ? 'green' : 'orange'}>{f.consent === 'granted' ? 'Consentimento ok' : 'Pendente'}</Badge>
                </li>
              ))}
            </Group>
            <Group title="Doações" count={r.donations.length}>
              {r.donations.map((d) => (
                <li key={d.id} className={rowClass}>
                  <div><Link to="/doacoes" className="font-bold hover:underline"><Highlight text={d.id} query={q} /></Link><p className="text-xs text-ink-600"><Highlight text={d.donorName} query={q} />, {formatDate(d.receivedAt)}</p></div>
                  <span className="text-ink-600">{d.weightKg} kg</span>
                </li>
              ))}
            </Group>
          </div>
        )
      )}
    </>
  )
}
