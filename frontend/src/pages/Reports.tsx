import { useState } from 'react'
import { Download } from 'lucide-react'
import { BarChart } from '../components/BarChart'
import { AsyncBoundary, Button, Card, controlClass, PageHeader, Skeleton, StatStrip } from '../components/ui'
import { useReports } from '../hooks/queries'
import { downloadCsv } from '../lib/csv'
import { formatNumber } from '../lib/utils'

export default function Reports() {
  const [months, setMonths] = useState(6)
  const report = useReports(months)
  const data = report.data

  const exportCsv = () => {
    if (!data) return
    downloadCsv(`doacoes-ultimos-${months}-meses.csv`, [['Mês', 'Doado (kg)', 'Distribuído (kg)'], ...data.monthly.map((m) => [m.month, m.donated, m.distributed])])
  }

  return (
    <>
      <PageHeader
        title="Relatórios de BI"
        description="Indicadores para a diretoria e para a prestação de contas."
        actions={
          <>
            <select aria-label="Período" value={months} onChange={(e) => setMonths(Number(e.target.value))} className={`${controlClass} w-auto`}>
              <option value={3}>Últimos 3 meses</option>
              <option value={6}>Últimos 6 meses</option>
            </select>
            <Button variant="secondary" onClick={exportCsv} disabled={!data}><Download size={16} aria-hidden="true" />Exportar CSV</Button>
          </>
        }
      />
      <AsyncBoundary isPending={report.isPending} isError={report.isError} error={report.error} onRetry={() => void report.refetch()} skeleton={<Skeleton className="h-96" />}>
        {data && (
          <div aria-busy={report.isFetching} className="space-y-5">
            <StatStrip stats={[
              { label: `Doado em ${months} meses`, value: `${formatNumber(data.donatedKg)} kg` },
              { label: `Distribuído em ${months} meses`, value: `${formatNumber(data.distributedKg)} kg` },
              { label: 'Perda por vencimento', value: `${((data.lossKg / data.donatedKg) * 100).toFixed(1).replace('.', ',')}%`, hint: 'Sobre o total doado no período' },
              { label: 'Cobertura de famílias', value: `${data.coveragePct}%` },
            ]} />
            <div className="grid gap-4 lg:grid-cols-3">
              <Card title="Evolução mensal" className="lg:col-span-2"><BarChart data={data.monthly} /></Card>
              <Card title="Perdas por categoria">
                <ul className="space-y-3 text-sm">
                  {data.loss.map((l) => (
                    <li key={l.category} className="flex items-center justify-between border-b border-cream-100 pb-2"><span>{l.category}</span><span className="font-bold">{l.kg} kg</span></li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        )}
      </AsyncBoundary>
    </>
  )
}
