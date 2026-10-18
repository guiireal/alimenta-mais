import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AsyncBoundary, BackLink, Button, Card, controlClass, Field, FormError, PageHeader } from '../components/ui'
import { useCatalog, useCreateDelivery, useFamilies, useRoutes } from '../hooks/queries'
import { useToast } from '../context/ToastContext'
import { decimalProblem } from '../lib/validators'
export default function DeliveryForm() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const routes = useRoutes()
  const families = useFamilies({ consent: 'granted' })
  const catalog = useCatalog()
  const create = useCreateDelivery()
  const route = routes.data?.find((r) => r.id === id)
  const [familyId, setFamily] = useState('')
  const [address, setAddress] = useState('')
  const [order, setOrder] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState([{ key: crypto.randomUUID(), productId: '', quantity: '' }])
  const [error, setError] = useState<unknown>(null)
  const sequence = order || String(Math.max(0, ...route?.stops.map((s) => s.order) ?? []) + 1)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!route || !familyId || !address.trim() || !/^\d+$/.test(sequence) || Number(sequence) < 1 || items.some((i) => !i.productId || decimalProblem(i.quantity))) { setError(new Error('Preencha a família, endereço, ordem e produtos com quantidades positivas.')); return }
    create.mutate({ routeId: id, warehouseId: route.warehouseId, familyId, address, order: sequence, description, items }, { onSuccess: () => { toast.success('Entrega criada com produtos selecionados por FEFO.'); navigate('/entregas?rota=' + id) } })
  }
  return <>
    <BackLink to={'/entregas?rota=' + id}>Voltar à rota</BackLink><PageHeader title="Adicionar entrega" description="O estoque será conferido ao salvar e novamente na saída da entrega." />
    <AsyncBoundary isPending={routes.isPending || families.isPending || catalog.isPending} isError={routes.isError || families.isError || catalog.isError} error={routes.error || families.error || catalog.error} onRetry={() => { void routes.refetch(); void families.refetch(); void catalog.refetch() }}>
      {!route ? <p>Rota não encontrada.</p> : <Card title={route.name}><form onSubmit={submit} noValidate className="space-y-4">
        <FormError error={error || create.error} /><div className="grid gap-3 sm:grid-cols-2">
          <Field label="Família com consentimento">{(a11y) => <select {...a11y} value={familyId} onChange={(e) => { setFamily(e.target.value); const f = families.data?.find((f) => f.id === e.target.value); setAddress(f ? [f.address, f.neighborhood, f.city, f.state].join(', ') : '') }} className={controlClass}><option value="">Selecionar família</option>{families.data?.filter((f) => f.active).map((f) => <option key={f.id} value={f.id}>{f.code} · {f.neighborhood}</option>)}</select>}</Field>
          <Field label="Ordem da parada">{(a11y) => <input {...a11y} type="number" min="1" value={sequence} onChange={(e) => setOrder(e.target.value)} className={controlClass} />}</Field>
          <Field label="Endereço de destino">{(a11y) => <input {...a11y} value={address} onChange={(e) => setAddress(e.target.value)} className={controlClass} />}</Field>
          <Field label="Descrição da entrega">{(a11y) => <input {...a11y} value={description} onChange={(e) => setDescription(e.target.value)} className={controlClass} />}</Field>
        </div>
        <ul className="space-y-3">{items.map((item, index) => <li key={item.key} className="grid gap-3 rounded-lg border border-cream-200 p-3 sm:grid-cols-3">
          <Field label={'Produto ' + (index + 1)}>{(a11y) => <select {...a11y} value={item.productId} onChange={(e) => setItems((prev) => prev.map((i) => i.key === item.key ? { ...i, productId: e.target.value } : i))} className={controlClass}><option value="">Selecionar produto</option>{catalog.data?.products.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}</select>}</Field>
          <Field label="Quantidade">{(a11y) => <input {...a11y} value={item.quantity} onChange={(e) => setItems((prev) => prev.map((i) => i.key === item.key ? { ...i, quantity: e.target.value } : i))} inputMode="decimal" className={controlClass} />}</Field>
          <Button variant="ghost" disabled={items.length === 1} onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}>Remover item</Button>
        </li>)}</ul><div className="flex justify-between"><Button variant="secondary" onClick={() => setItems((prev) => [...prev, { key: crypto.randomUUID(), productId: '', quantity: '' }])}>Adicionar produto</Button><Button type="submit" disabled={create.isPending || route.status !== 'waiting'}>Salvar entrega</Button></div>
      </form></Card>}
    </AsyncBoundary>
  </>
}
