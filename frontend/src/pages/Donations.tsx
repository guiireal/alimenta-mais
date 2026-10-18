import { useState, type FormEvent } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { AsyncBoundary, Badge, Button, Card, controlClass, Field, FormError, PageHeader, Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useCreateDonation, useDonations, useDonors } from '../hooks/queries'
import { cn, formatDate, parseNumber, todayInput } from '../lib/utils'
import { donationHasErrors, validateDonation, type DonationErrors, type DraftItem } from '../lib/validators'
import type { Category, DonationStage, Tone, TriageStatus } from '../types'

const STAGES: { key: DonationStage; label: string }[] = [
  { key: 'received', label: 'Recebida' },
  { key: 'triage', label: 'Em triagem' },
  { key: 'stored', label: 'Armazenada' },
  { key: 'available', label: 'Disponível para distribuição' },
]
const STAGE_TONE: Record<DonationStage, Tone> = { received: 'neutral', triage: 'orange', stored: 'green', available: 'green' }
const TRIAGE: Record<TriageStatus, string> = { approved: 'Aprovado', review: 'Em análise', rejected: 'Recusado' }
const CATEGORIES: Category[] = ['Laticínios', 'Panificados', 'Grãos', 'Massas', 'Óleos', 'Hortifrúti']

const emptyItem = (): DraftItem => ({ key: crypto.randomUUID(), name: '', category: '', quantity: '', expiresAt: '', triage: 'approved' })

export default function Donations() {
  const { can } = useAuth()
  const toast = useToast()
  const donations = useDonations()
  const donors = useDonors()
  const create = useCreateDonation()

  const [donorId, setDonorId] = useState('')
  const [receivedAt, setReceivedAt] = useState(todayInput())
  const [docNumber, setDocNumber] = useState('')
  const [items, setItems] = useState<DraftItem[]>([emptyItem()])
  const [errors, setErrors] = useState<DonationErrors | null>(null)

  const patchItem = (key: string, patch: Partial<DraftItem>) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const found = validateDonation({ donorId, receivedAt, items })
    setErrors(found)
    if (donationHasErrors(found)) {
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    create.mutate(
      {
        donorId,
        receivedAt,
        document: docNumber,
        items: items.map((i) => ({ name: i.name.trim(), category: i.category as Category, quantity: parseNumber(i.quantity), expiresAt: i.expiresAt || null, triage: i.triage })),
      },
      {
        onSuccess: ({ donation, lotIds }) => {
          toast.success(`Entrada ${donation.id} registrada. ${lotIds.length} ${lotIds.length === 1 ? 'lote criado' : 'lotes criados'} no estoque.`)
          setDonorId('')
          setDocNumber('')
          setItems([emptyItem()])
          setErrors(null)
        },
      },
    )
  }

  const latest = donations.data?.[0]
  const currentIndex = STAGES.findIndex((s) => s.key === (latest?.stage ?? 'received'))

  return (
    <>
      <PageHeader title="Doações" description="Registre o recebimento, faça a triagem e libere os itens para o estoque." />

      <div className="grid gap-4 xl:grid-cols-3">
        {can('donation:write') ? (
          <Card title="Registrar recebimento" className="xl:col-span-2">
            <form onSubmit={submit} noValidate className="space-y-5">
              <FormError error={create.error} />
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Doador" error={errors?.donorId}>
                  {(a11y) => (
                    <select {...a11y} value={donorId} onChange={(e) => setDonorId(e.target.value)} className={controlClass}>
                      <option value="">Selecionar doador</option>
                      {donors.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  )}
                </Field>
                <Field label="Data de entrada" error={errors?.receivedAt}>
                  {(a11y) => <input {...a11y} type="date" max={todayInput()} value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className={controlClass} />}
                </Field>
                <Field label="Termo ou nota de doação">
                  {(a11y) => <input {...a11y} value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="Número do documento" className={controlClass} />}
                </Field>
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-ink-600">Itens recebidos</legend>
                {errors?.items && <p role="alert" className="mb-2 text-sm font-semibold text-tomato-600">{errors.items}</p>}
                <ul className="space-y-3">
                  {items.map((item, index) => {
                    const e = errors?.byItem[item.key]
                    return (
                      <li key={item.key} className="rounded-lg border border-cream-200 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-bold">Item {index + 1}</span>
                          <Button variant="ghost" className="h-8 px-2" aria-label={`Remover item ${index + 1}`} disabled={items.length === 1} onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}>
                            <Trash2 size={16} aria-hidden="true" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                          <Field label="Item" error={e?.name} className="col-span-2 sm:col-span-3">
                            {(a11y) => <input {...a11y} value={item.name} onChange={(ev) => patchItem(item.key, { name: ev.target.value })} className={controlClass} />}
                          </Field>
                          <Field label="Categoria" error={e?.category} className="col-span-2 sm:col-span-3">
                            {(a11y) => (
                              <select {...a11y} value={item.category} onChange={(ev) => patchItem(item.key, { category: ev.target.value })} className={controlClass}>
                                <option value="">Selecionar</option>
                                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            )}
                          </Field>
                          <Field label="Quantidade" error={e?.quantity} className="sm:col-span-2">
                            {(a11y) => <input {...a11y} inputMode="decimal" value={item.quantity} onChange={(ev) => patchItem(item.key, { quantity: ev.target.value })} className={controlClass} />}
                          </Field>
                          <Field label="Validade" error={e?.expiresAt} className="sm:col-span-2">
                            {(a11y) => <input {...a11y} type="date" value={item.expiresAt} onChange={(ev) => patchItem(item.key, { expiresAt: ev.target.value })} className={controlClass} />}
                          </Field>
                          <Field label="Triagem" className="col-span-2 sm:col-span-2">
                            {(a11y) => (
                              <select {...a11y} value={item.triage} onChange={(ev) => patchItem(item.key, { triage: ev.target.value as TriageStatus })} className={controlClass}>
                                {(Object.keys(TRIAGE) as TriageStatus[]).map((t) => <option key={t} value={t}>{TRIAGE[t]}</option>)}
                              </select>
                            )}
                          </Field>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <Button variant="secondary" className="mt-3" onClick={() => setItems((prev) => [...prev, emptyItem()])}><Plus size={16} aria-hidden="true" />Adicionar item</Button>
              </fieldset>

              <div className="flex justify-end">
                <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Registrando…' : 'Confirmar entrada'}</Button>
              </div>
            </form>
          </Card>
        ) : (
          <Card title="Registrar recebimento" className="xl:col-span-2">
            <p className="text-sm text-ink-600">O seu perfil só consulta doações. Para registrar um recebimento, peça acesso ao gestor.</p>
          </Card>
        )}

        <div className="space-y-4">
          <Card title="Etapas da última doação">
            <ol className="space-y-3">
              {STAGES.map((s, idx) => {
                const done = idx <= currentIndex
                return (
                  <li key={s.key} className="flex items-center gap-3 text-sm font-semibold" aria-current={idx === currentIndex ? 'step' : undefined}>
                    <span className={cn('grid size-7 place-items-center rounded-full text-xs', done ? 'bg-leaf-600 text-white' : 'border-2 border-dashed border-cream-500 text-ink-600')}>
                      {done ? <Check size={14} aria-hidden="true" /> : idx + 1}
                    </span>
                    {s.label}
                  </li>
                )
              })}
            </ol>
          </Card>

          <Card title="Últimas doações">
            <AsyncBoundary isPending={donations.isPending} isError={donations.isError} error={donations.error} onRetry={() => void donations.refetch()} skeleton={<Skeleton className="h-40" />}>
              <ul className="divide-y divide-cream-100">
                {donations.data?.slice(0, 6).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div>
                      <p className="font-semibold">{d.donorName}</p>
                      <p className="text-xs text-ink-600">{d.id}, {formatDate(d.receivedAt)}, {d.weightKg} kg</p>
                    </div>
                    <Badge tone={STAGE_TONE[d.stage]}>{STAGES.find((s) => s.key === d.stage)?.label}</Badge>
                  </li>
                ))}
              </ul>
            </AsyncBoundary>
          </Card>
        </div>
      </div>
    </>
  )
}
