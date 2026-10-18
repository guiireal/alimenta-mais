import { useNavigate } from 'react-router-dom'
import { BackLink, Button, Card, controlClass, Field, FormError, LinkButton, PageHeader } from '../components/ui'
import { useToast } from '../context/ToastContext'
import { useCreateLot } from '../hooks/queries'
import { useForm } from '../lib/hooks'
import { defaultWarehouse, parseNumber, todayInput } from '../lib/utils'
import { validateLot, type LotValues } from '../lib/validators'
import type { Category, Warehouse } from '../types'

const CATEGORIES: Category[] = ['Laticínios', 'Panificados', 'Grãos', 'Massas', 'Óleos', 'Hortifrúti']
const WAREHOUSES: Warehouse[] = ['Câmara fria', 'Seco A', 'Seco B']

export default function LotForm() {
  const navigate = useNavigate()
  const toast = useToast()
  const createLot = useCreateLot()
  const form = useForm<LotValues>({ item: '', category: '', quantity: '', unit: 'un', expiresAt: '', warehouse: '' }, validateLot)

  const onSubmit = form.submit((v) =>
    createLot.mutate(
      {
        item: v.item.trim(),
        category: v.category as Category,
        quantity: parseNumber(v.quantity),
        unit: v.unit === 'kg' ? 'kg' : 'un',
        expiresAt: v.expiresAt ? new Date(`${v.expiresAt}T12:00:00`).toISOString() : null,
        warehouse: v.warehouse as Warehouse,
      },
      { onSuccess: (lot) => { toast.success(`Lote ${lot.id} registrado.`); navigate(`/estoque/${lot.id}`) } },
    ),
  )

  return (
    <>
      <BackLink to="/estoque">Voltar ao estoque</BackLink>
      <PageHeader title="Novo lote" description="Registre uma entrada manual no estoque. Doações aprovadas já geram lotes automaticamente." />
      <Card className="max-w-3xl">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError error={createLot.error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Item" error={form.errors.item} className="sm:col-span-2">
              {(a11y) => <input {...a11y} {...form.bind('item')} placeholder="Ex.: Feijão carioca 1 kg" className={controlClass} />}
            </Field>
            <Field label="Categoria" error={form.errors.category}>
              {(a11y) => (
                <select
                  {...a11y}
                  {...form.bind('category')}
                  onChange={(e) => {
                    form.setValue('category', e.target.value)
                    if (e.target.value) form.setValue('warehouse', defaultWarehouse(e.target.value as Category))
                  }}
                  className={controlClass}
                >
                  <option value="">Selecionar categoria</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </Field>
            <Field label="Depósito" error={form.errors.warehouse}>
              {(a11y) => (
                <select {...a11y} {...form.bind('warehouse')} className={controlClass}>
                  <option value="">Selecionar depósito</option>
                  {WAREHOUSES.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              )}
            </Field>
            <Field label="Quantidade" error={form.errors.quantity}>
              {(a11y) => <input {...a11y} {...form.bind('quantity')} inputMode="decimal" placeholder="0" className={controlClass} />}
            </Field>
            <Field label="Unidade">
              {(a11y) => (
                <select {...a11y} {...form.bind('unit')} className={controlClass}>
                  <option value="un">Unidades</option>
                  <option value="kg">Quilos</option>
                </select>
              )}
            </Field>
            <Field label="Validade" error={form.errors.expiresAt} hint="Sem validade, o lote fica fora do controle FEFO." className="sm:col-span-2">
              {(a11y) => <input {...a11y} {...form.bind('expiresAt')} type="date" min={todayInput()} className={`${controlClass} sm:max-w-xs`} />}
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <LinkButton to="/estoque" variant="secondary">Cancelar</LinkButton>
            <Button type="submit" disabled={createLot.isPending}>{createLot.isPending ? 'Salvando…' : 'Registrar lote'}</Button>
          </div>
        </form>
      </Card>
    </>
  )
}
