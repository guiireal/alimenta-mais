import { Link, useSearchParams } from 'react-router-dom'
import { Download, Plus, Search } from 'lucide-react'
import { ExpiryBadge } from '../components/ExpiryBadge'
import { Pagination } from '../components/Pagination'
import { ShelfLife } from '../components/ShelfLife'
import { AsyncBoundary, Button, Card, controlClass, EmptyRow, ErrorState, LinkButton, PageHeader, Skeleton, SortHeader, StatStrip, TableScroll, tdClass, thClass } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useCatalog, useExportLots, useLots, useStockStats } from '../hooks/queries'
import { useToast } from '../context/ToastContext'
import { downloadCsv } from '../lib/csv'
import { useDebouncedValue } from '../lib/hooks'
import { daysLabel, errorMessage, EXPIRY_META, formatDate, getExpiryStatus } from '../lib/utils'
import type { Category, LotQuery, LotSortKey, LotStatusFilter, SortDir } from '../types'

const STATUSES: readonly LotStatusFilter[] = ['all', 'alert', 'expired', 'critical', 'warning', 'ok', 'none']
const SORTS: readonly LotSortKey[] = ['expiresAt', 'item', 'quantity', 'id']
const STATUS_LABEL = (s: LotStatusFilter) => (s === 'all' ? 'Todas as situações' : s === 'alert' ? 'Vencidos e críticos' : EXPIRY_META[s].label)

/** A URL é editável pelo usuário: valores fora da lista caem no padrão em vez de quebrar a tela. */
const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(value ?? '') ? (value as T) : fallback

export default function Inventory() {
  const { can } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const catalog = useCatalog()

  const query: LotQuery = {
    q: params.get('q') ?? '',
    category: /^\d+$/.test(params.get('categoria') ?? '') ? params.get('categoria') as Category : 'all',
    status: pick(params.get('status'), STATUSES, 'all'),
    sort: pick(params.get('ordem'), SORTS, 'expiresAt'),
    dir: pick<SortDir>(params.get('dir'), ['asc', 'desc'], 'asc'),
    page: Math.max(1, Math.min(1000000, Math.trunc(Number(params.get('page')) || 1))),
  }
  const debouncedQ = useDebouncedValue(query.q ?? '', 300)

  const lots = useLots({ ...query, q: debouncedQ })
  const stats = useStockStats()
  const exportLots = useExportLots()

  /** Filtros e ordenação ficam na URL: o link da tela é compartilhável e o botão voltar funciona. */
  const patch = (changes: Record<string, string | undefined>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === '') next.delete(key)
        else next.set(key, value)
      }
      if (!('page' in changes)) next.delete('page')
      return next
    }, { replace: true })

  const sortBy = (key: LotSortKey) =>
    patch(query.sort === key ? { dir: query.dir === 'asc' ? 'desc' : 'asc' } : { ordem: key === 'expiresAt' ? undefined : key, dir: undefined })

  const onExport = () =>
    exportLots.mutate({ ...query, q: debouncedQ }, {
      onSuccess: ({ items }) => {
        downloadCsv('estoque.csv', [
          ['Lote', 'Item', 'Categoria', 'Quantidade', 'Unidade', 'Validade', 'Situação', 'Depósito'],
          ...items.map((l) => [l.id, l.item, l.category, l.quantity, l.unit, l.expiresAt ? formatDate(l.expiresAt) : '', EXPIRY_META[getExpiryStatus(l.expiresAt)].label, l.warehouse]),
        ])
        toast.success(`${items.length} lotes exportados.`)
      },
      onError: (e) => toast.error(errorMessage(e)),
    })

  const hasFilters = Boolean(query.q || query.category !== 'all' || query.status !== 'all')
  const isActiveSort = (key: LotSortKey) => query.sort === key

  return (
    <>
      <PageHeader
        title="Estoque e validade"
        description="Lotes ordenados pelo FEFO: o que vence primeiro aparece primeiro."
        actions={
          <>
            <Button variant="secondary" onClick={onExport} disabled={exportLots.isPending}><Download size={16} aria-hidden="true" />{exportLots.isPending ? 'Exportando…' : 'Exportar CSV'}</Button>
            {can('stock:write') && <LinkButton to="/estoque/novo"><Plus size={16} aria-hidden="true" />Novo lote</LinkButton>}
          </>
        }
      />

      {stats.data ? (
        <StatStrip
          stats={[
            { label: 'Lotes vencidos', value: String(stats.data.expired), hint: 'Dar baixa e registrar descarte' },
            { label: 'Vencem em até 7 dias', value: String(stats.data.week), hint: 'Priorizar a distribuição' },
            { label: 'Lotes com validade registrada', value: `${stats.data.registeredPct}%` },
          ]}
        />
      ) : stats.isError ? <ErrorState message={errorMessage(stats.error)} onRetry={() => void stats.refetch()} /> : <Skeleton className="h-24" />}

      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="relative">
            <span className="sr-only">Buscar por item ou lote</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-600" aria-hidden="true" />
            <input type="search" value={query.q} onChange={(e) => patch({ q: e.target.value })} placeholder="Buscar item ou lote" className={`${controlClass} pl-9`} />
          </label>
          <select aria-label="Categoria" value={query.category} onChange={(e) => patch({ categoria: e.target.value === 'all' ? undefined : e.target.value })} className={controlClass}>
            <option value="all">Todas as categorias</option>
            {catalog.data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select aria-label="Situação da validade" value={query.status} onChange={(e) => patch({ status: e.target.value === 'all' ? undefined : e.target.value })} className={controlClass}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL(s)}</option>)}
          </select>
        </div>

        <AsyncBoundary isPending={lots.isPending} isError={lots.isError} error={lots.error} onRetry={() => void lots.refetch()} skeleton={<Skeleton className="h-72" />}>
          <div aria-busy={lots.isFetching} className={lots.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
            <TableScroll minWidth="min-w-[720px]">
              <thead>
                <tr>
                  <SortHeader label="Lote" active={isActiveSort('id')} dir={query.dir ?? 'asc'} onSort={() => sortBy('id')} />
                  <SortHeader label="Item" active={isActiveSort('item')} dir={query.dir ?? 'asc'} onSort={() => sortBy('item')} />
                  <th className={`${thClass} hidden md:table-cell`}>Categoria</th>
                  <SortHeader label="Qtd." active={isActiveSort('quantity')} dir={query.dir ?? 'asc'} onSort={() => sortBy('quantity')} />
                  <SortHeader label="Validade" active={isActiveSort('expiresAt')} dir={query.dir ?? 'asc'} onSort={() => sortBy('expiresAt')} />
                  <th className={thClass}>Situação</th>
                  <th className={`${thClass} hidden lg:table-cell`}>Depósito</th>
                </tr>
              </thead>
              <tbody>
                {lots.data?.items.length === 0 && (
                  <EmptyRow colSpan={7}>
                    {hasFilters ? <>Nenhum lote encontrado. <button type="button" className="font-bold text-leaf-700 underline" onClick={() => setParams({}, { replace: true })}>Limpar filtros</button></> : 'Nenhum lote em estoque.'}
                  </EmptyRow>
                )}
                {lots.data?.items.map((lot) => (
                  <tr key={lot.id}>
                    <td className={`${tdClass} font-semibold`}>{lot.id}</td>
                    <td className={tdClass}><Link to={`/estoque/${lot.id}`} className="font-semibold text-leaf-800 hover:underline">{lot.item}</Link></td>
                    <td className={`${tdClass} hidden md:table-cell`}>{lot.category}</td>
                    <td className={tdClass}>{lot.quantity} {lot.unit}</td>
                    <td className={`${tdClass} min-w-40`}>
                      <p>{lot.expiresAt ? formatDate(lot.expiresAt) : 'Não informada'}</p>
                      <p className="text-xs text-ink-600">{daysLabel(lot.expiresAt)}</p>
                      <ShelfLife expiresAt={lot.expiresAt} className="mt-1" />
                    </td>
                    <td className={tdClass}><ExpiryBadge expiresAt={lot.expiresAt} /></td>
                    <td className={`${tdClass} hidden lg:table-cell`}>{lot.warehouse}</td>
                  </tr>
                ))}
              </tbody>
            </TableScroll>
          </div>
          {lots.data && <Pagination page={lots.data.page} pageSize={lots.data.pageSize} total={lots.data.total} onPage={(page) => patch({ page: String(page) })} />}
        </AsyncBoundary>
      </Card>
    </>
  )
}
