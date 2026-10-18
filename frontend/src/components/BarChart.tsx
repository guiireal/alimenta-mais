import type { MonthlyPoint } from '../types'
import { formatNumber } from '../lib/utils'

export function BarChart({ data }: { data: MonthlyPoint[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.donated, d.distributed)))
  const summary = data.map((d) => `${d.month}: ${formatNumber(d.donated)} kg doados, ${formatNumber(d.distributed)} kg distribuídos`).join('; ')
  return (
    <figure>
      <div role="img" aria-label={`Doações e distribuição por mês. ${summary}`} className="flex h-56 items-end gap-3 border-b-2 border-cream-300 px-1 sm:gap-5 sm:px-2">
        {data.map((d) => (
          <div key={d.month} className="flex h-full flex-1 items-end gap-1">
            <div className="flex-1 rounded-t bg-carrot-500" style={{ height: `${(d.donated / max) * 100}%` }} />
            <div className="flex-1 rounded-t bg-leaf-600" style={{ height: `${(d.distributed / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-3 px-1 text-xs text-ink-600 sm:gap-5 sm:px-2" aria-hidden="true">
        {data.map((d) => <span key={d.month} className="flex-1 text-center">{d.month}</span>)}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-600">
        <span className="flex items-center gap-2"><span className="size-3 rounded-sm bg-carrot-500" />Doado (kg)</span>
        <span className="flex items-center gap-2"><span className="size-3 rounded-sm bg-leaf-600" />Distribuído (kg)</span>
      </figcaption>
    </figure>
  )
}
