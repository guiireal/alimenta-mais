import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../lib/utils'

/** Barra de busca global: Enter leva para /busca?q=... */
export function SearchForm({ defaultValue = '', className, inputClassName, autoFocus }: { defaultValue?: string; className?: string; inputClassName?: string; autoFocus?: boolean }) {
  const navigate = useNavigate()
  return (
    <form
      role="search"
      className={cn('relative', className)}
      onSubmit={(e) => {
        e.preventDefault()
        const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
        if (q) navigate(`/busca?q=${encodeURIComponent(q)}`)
      }}
    >
      <label className="block">
        <span className="sr-only">Buscar item, lote, doador ou família</span>
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-600" aria-hidden="true" />
        <input
          name="q"
          type="search"
          defaultValue={defaultValue}
          autoFocus={autoFocus}
          placeholder="Buscar item, lote, doador ou família"
          className={cn('h-10 w-full rounded-full border border-cream-500 bg-white pl-9 pr-3 text-sm placeholder:text-ink-600', inputClassName)}
        />
      </label>
    </form>
  )
}
