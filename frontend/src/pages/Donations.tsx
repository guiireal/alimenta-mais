import { useState, type FormEvent } from 'react'
import { BatchFields } from '../components/BatchFields'
import { AsyncBoundary, Badge, Button, Card, controlClass, Field, FormError, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useCatalog, useConfirmDonation, useCreateDonation, useDonation, useDonations, useDonors, useTriageBatch } from '../hooks/queries'
import { formatDate, todayInput } from '../lib/utils'
import { donationHasErrors, validateDonation, type DonationErrors, type DraftItem } from '../lib/validators'
import type { BatchDTO } from '../services/donations'
import type { DonationStage, TriageStatus } from '../types'

const STAGES: Record<DonationStage, string> = { draft: 'Rascunho', received: 'Recebida', triage: 'Em triagem', stored: 'Armazenada', available: 'Disponível' }
const TRIAGE: Record<TriageStatus, string> = { approved: 'Aprovado', review: 'Em análise', rejected: 'Recusado' }
const emptyItem = (): DraftItem => ({ key: crypto.randomUUID(), productId: '', batchCode: '', quantity: '', unitWeightKg: '1', expiresAt: '', warehouse: '', triage: 'approved' })

function TriageBatch({ batch }: { batch: BatchDTO }) {
  const catalog = useCatalog()
  const action = useTriageBatch()
  const toast = useToast()
  const [warehouseId, setWarehouse] = useState('')
  const [expiresOn, setExpires] = useState(batch.expires_on ?? '')
  const [notes, setNotes] = useState('')
  const product = catalog.data?.products.find((p) => p.id === batch.product_id)
  const perishable = catalog.data?.categories.find((c) => c.id === product?.category_id)?.is_perishable
  const apply = (status: 'approved' | 'rejected') => action.mutate({ id: String(batch.id), status, warehouseId, expiresOn, notes }, { onSuccess: () => toast.success('Triagem registrada.') })
  return <li className="space-y-3 rounded-lg border border-cream-200 p-3">
    <p className="font-bold">{product?.name ?? 'Produto #' + batch.product_id} · Lote {batch.batch_code} · {batch.received_quantity}</p>
    <Badge>{batch.triage_status === 'pending' ? 'Pendente' : batch.triage_status === 'approved' ? 'Aprovado' : 'Recusado'}</Badge>
    {batch.triage_status === 'pending' && <><FormError error={action.error} /><div className="grid gap-3 sm:grid-cols-2">
      <Field label="Validade">{(a11y) => <input {...a11y} type="date" value={expiresOn} onChange={(e) => setExpires(e.target.value)} className={controlClass} />}</Field>
      <Field label="Depósito para aprovação">{(a11y) => <select {...a11y} value={warehouseId} onChange={(e) => setWarehouse(e.target.value)} className={controlClass}><option value="">Selecionar depósito</option>{catalog.data?.warehouses.filter((w) => w.is_active && (!perishable || w.is_cold_storage)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}</Field>
      <Field label="Observação da triagem">{(a11y) => <input {...a11y} value={notes} onChange={(e) => setNotes(e.target.value)} className={controlClass} />}</Field>
    </div><div className="flex gap-2"><Button disabled={action.isPending || !warehouseId || !expiresOn} onClick={() => apply('approved')}>Aprovar</Button><Button variant="secondary" disabled={action.isPending} onClick={() => apply('rejected')}>Recusar</Button></div></>}
  </li>
}
function DonationReview({ id }: { id: string }) {
  const query = useDonation(id)
  const confirm = useConfirmDonation()
  const { can } = useAuth()
  const toast = useToast()
  return <Card title={'Doação #' + id}><AsyncBoundary isPending={query.isPending} isError={query.isError} error={query.error} onRetry={() => void query.refetch()}>
    {query.data && <div className="space-y-3"><ul className="space-y-3">{query.data.batches.map((b) => can('donation:write') ? <TriageBatch key={b.id} batch={b} /> : <li key={b.id}>Lote {b.batch_code}: {b.triage_status}</li>)}</ul>
      <FormError error={confirm.error} />
      {can('donation:write') && !query.data.donation.confirmed_at && <Button disabled={confirm.isPending || query.data.batches.some((b) => b.triage_status === 'pending') || !query.data.batches.some((b) => b.triage_status === 'approved')} onClick={() => confirm.mutate(id, { onSuccess: () => toast.success('Doação disponibilizada.') })}>Confirmar e disponibilizar doação</Button>}
    </div>}
  </AsyncBoundary></Card>
}
export default function Donations() {
  const { can } = useAuth()
  const toast = useToast()
  const donations = useDonations()
  const donors = useDonors()
  const create = useCreateDonation()
  const [selected, setSelected] = useState('')
  const [donorId, setDonorId] = useState('')
  const [receivedAt, setReceivedAt] = useState(todayInput())
  const [document, setDocument] = useState('')
  const [items, setItems] = useState<DraftItem[]>([emptyItem()])
  const [errors, setErrors] = useState<DonationErrors | null>(null)
  const patchItem = (key: string, patch: Partial<DraftItem>) => setItems((prev) => prev.map((i) => i.key === key ? { ...i, ...patch } : i))
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const found = validateDonation({ donorId, receivedAt, items })
    setErrors(found)
    if (donationHasErrors(found)) {
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    create.mutate({ donorId, receivedAt, document, items }, { onSuccess: ({ donation }) => {
      toast.success('Doação registrada. Confira a triagem e confirme a disponibilização.')
      setSelected(donation.id); setItems([emptyItem()]); setDocument(''); setErrors(null)
    } })
  }
  return <>
    <PageHeader title="Doações" description="Registre o recebimento, conclua a triagem e confirme a disponibilização." />
    {can('donation:write') && <Card title="Registrar recebimento"><form onSubmit={submit} noValidate className="space-y-4">
      <FormError error={create.error || donors.error} /><div className="grid gap-3 sm:grid-cols-3">
        <Field label="Doador" error={errors?.donorId}>{(a11y) => <select {...a11y} value={donorId} onChange={(e) => setDonorId(e.target.value)} className={controlClass}><option value="">Selecionar doador</option>{donors.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>}</Field>
        <Field label="Data de entrada" error={errors?.receivedAt}>{(a11y) => <input {...a11y} type="date" max={todayInput()} value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className={controlClass} />}</Field>
        <Field label="Termo ou nota de doação">{(a11y) => <input {...a11y} value={document} onChange={(e) => setDocument(e.target.value)} className={controlClass} />}</Field>
      </div>
      <ul className="space-y-4">{items.map((item, index) => <li key={item.key} className="space-y-3 rounded-lg border border-cream-200 p-3">
        <div className="flex justify-between"><h3 className="font-bold">Item {index + 1}</h3><Button variant="ghost" disabled={items.length === 1} onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}>Remover item</Button></div>
        <BatchFields values={item} errors={errors?.byItem[item.key]} onChange={(patch) => patchItem(item.key, patch)} />
        <Field label="Triagem">{(a11y) => <select {...a11y} value={item.triage} onChange={(e) => patchItem(item.key, { triage: e.target.value as TriageStatus })} className={controlClass}>{Object.entries(TRIAGE).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>}</Field>
      </li>)}</ul><FormError error={errors?.items ? new Error(errors.items) : null} />
      <div className="flex flex-wrap justify-between gap-2"><Button variant="secondary" disabled={items.length >= 100} onClick={() => setItems((prev) => [...prev, emptyItem()])}>Adicionar item</Button><Button type="submit" disabled={create.isPending}>Registrar recebimento</Button></div>
    </form></Card>}
    <Card title="Doações registradas"><AsyncBoundary isPending={donations.isPending} isError={donations.isError} error={donations.error} onRetry={() => void donations.refetch()}>
      <ul className="divide-y divide-cream-100">{donations.data?.map((d) => <li key={d.id}><button type="button" onClick={() => setSelected(d.id)} aria-pressed={selected === d.id} className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm hover:bg-cream-100">
        <span><span className="block font-bold">#{d.id} · {d.donorName}</span>{formatDate(d.receivedAt)} · {d.weightKg} kg</span><Badge tone={d.stage === 'triage' ? 'orange' : 'green'}>{STAGES[d.stage]}</Badge>
      </button></li>)}</ul>{donations.data?.length === 0 && <p className="text-sm text-ink-600">Nenhuma doação registrada.</p>}
    </AsyncBoundary></Card>
    {selected && <DonationReview key={selected} id={selected} />}
  </>
}
