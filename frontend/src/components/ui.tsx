import { useId, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn, errorMessage } from '../lib/utils'
import type { SortDir, Tone } from '../types'

/* ---------- estrutura ---------- */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-sm text-ink-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function Card({ title, action, className, children }: { title?: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn('rounded-xl border border-cream-200 bg-white p-4 sm:p-5', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export interface Stat { label: string; value: string; hint?: string }
const STRIP_COLS = { 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' } as const

/** Faixa única de indicadores: uma superfície com divisórias, em vez de vários cards iguais. */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <dl className={cn('grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-cream-200 bg-cream-200', stats.length === 3 ? STRIP_COLS[3] : STRIP_COLS[4])}>
      {stats.map((s) => (
        <div key={s.label} className="bg-white p-4">
          <dt className="text-sm text-ink-600">{s.label}</dt>
          <dd className="mt-1 text-2xl font-extrabold sm:text-3xl">{s.value}</dd>
          {s.hint && <p className="mt-0.5 text-xs text-ink-600">{s.hint}</p>}
        </div>
      ))}
    </dl>
  )
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-bold text-leaf-700 hover:underline">
      <ArrowLeft size={16} aria-hidden="true" />{children}
    </Link>
  )
}

/* ---------- botões e selos ---------- */
const TONES: Record<Tone, string> = {
  green: 'bg-leaf-100 text-leaf-800',
  orange: 'bg-carrot-100 text-carrot-800',
  red: 'bg-tomato-600 text-white',
  neutral: 'bg-cream-100 text-ink-600',
}

export function Badge({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold', TONES[tone], className)}>
      {children}
    </span>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
const BUTTONS: Record<ButtonVariant, string> = {
  primary: 'bg-leaf-600 text-white hover:bg-leaf-700',
  secondary: 'border border-leaf-600 bg-white text-leaf-900 hover:bg-leaf-100',
  ghost: 'text-ink-600 hover:bg-cream-100',
  danger: 'bg-tomato-600 text-white hover:opacity-90',
}
export const buttonClass = (variant: ButtonVariant = 'primary', className?: string): string =>
  cn('inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50', BUTTONS[variant], className)

export function Button({ variant = 'primary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type="button" {...props} className={buttonClass(variant, className)} />
}

/** Link com aparência de botão: use quando o clique só leva a outra tela. */
export function LinkButton({ variant = 'primary', className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link {...props} className={buttonClass(variant, className)} />
}

/* ---------- formulário ---------- */
export interface FieldA11y { id: string; 'aria-invalid': true | undefined; 'aria-describedby': string | undefined }

/** Rótulo, mensagem de erro e ids de acessibilidade ligados ao controle, que recebe os props por função. */
export function Field({ label, error, hint, className, children }: { label: string; error?: string; hint?: string; className?: string; children: (a11y: FieldA11y) => ReactNode }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink-600">{label}</label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? <p id={`${id}-error`} className="mt-1 text-sm font-semibold text-tomato-600">{error}</p>
        : hint && <p id={`${id}-hint`} className="mt-1 text-xs text-ink-600">{hint}</p>}
    </div>
  )
}

export const controlClass =
  'h-10 w-full rounded-lg border border-cream-500 bg-white px-3 text-sm placeholder:text-ink-600 disabled:bg-cream-100 aria-invalid:border-2 aria-invalid:border-tomato-600'

export function FormError({ error }: { error: unknown }) {
  if (!error) return null
  return <p role="alert" className="rounded-lg bg-tomato-100 px-3 py-2 text-sm font-semibold text-tomato-600">{errorMessage(error)}</p>
}

/* ---------- tabelas ---------- */
export const thClass = 'whitespace-nowrap border-b-2 border-cream-200 px-3 py-2 text-left text-sm font-bold text-ink-600'
export const tdClass = 'border-b border-cream-100 px-3 py-3 align-middle'

/** Tabela com rolagem horizontal contida no card, para o corpo da página nunca rolar de lado. */
export function TableScroll({ children, minWidth = 'min-w-[640px]' }: { children: ReactNode; minWidth?: string }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className={cn('w-full text-sm', minWidth)}>{children}</table>
    </div>
  )
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return <tr><td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-ink-600">{children}</td></tr>
}

export function SortHeader({ label, active, dir, onSort, className }: { label: string; active: boolean; dir: SortDir; onSort: () => void; className?: string }) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn(thClass, className)}>
      <button type="button" onClick={onSort} className="inline-flex items-center gap-1 font-bold hover:text-ink-900">
        {label}<Icon size={14} aria-hidden="true" className={active ? '' : 'opacity-40'} />
      </button>
    </th>
  )
}

/* ---------- estados de carregamento, erro e vazio ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-lg bg-cream-100', className)} />
}

export function ErrorState({ title = 'Não foi possível carregar', message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-tomato-600/40 bg-tomato-100 p-5">
      <p className="font-bold text-tomato-600">{title}</p>
      <p className="mt-1 text-sm">{message}</p>
      {onRetry && <Button variant="secondary" className="mt-3" onClick={() => onRetry()}>Tentar novamente</Button>}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-cream-300 bg-white p-8 text-center">
      <p className="font-bold">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink-600">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

/** Mostra esqueleto enquanto carrega, erro com nova tentativa ao falhar, e o conteúdo quando há dados. */
export function AsyncBoundary({ isPending, isError, error, onRetry, skeleton, children }: {
  isPending: boolean; isError: boolean; error: unknown; onRetry?: () => void; skeleton?: ReactNode; children: ReactNode
}) {
  if (isPending) return <>{skeleton ?? <Skeleton className="h-40" />}</>
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={onRetry} />
  return <>{children}</>
}

/** Destaca o trecho buscado dentro de um texto. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i'))
  return <>{parts.map((p, i) => (p.toLowerCase() === q.toLowerCase() ? <mark key={i} className="rounded bg-carrot-100 px-0.5 text-ink-900">{p}</mark> : p))}</>
}
