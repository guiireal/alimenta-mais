import { useCatalog } from '../hooks/queries'
import type { Errors, LotValues } from '../lib/validators'
import { controlClass, Field, FormError } from './ui'

export function BatchFields({ values, errors = {}, onChange }: { values: LotValues; errors?: Errors<LotValues>; onChange: (patch: Partial<LotValues>) => void }) {
  const catalog = useCatalog()
  const product = catalog.data?.products.find((p) => String(p.id) === values.productId)
  const category = catalog.data?.categories.find((c) => c.id === product?.category_id)
  return <div className="grid gap-3 sm:grid-cols-2">
    <FormError error={catalog.error} />
    <Field label="Produto" error={errors.productId} hint={catalog.isPending ? 'Carregando cadastros…' : product ? `Unidade: ${product.unit}${category?.is_perishable ? ' · Exige refrigeração' : ''}` : 'Cadastre produtos e depósitos em Cadastros.'}>
      {(a11y) => <select {...a11y} value={values.productId} onChange={(e) => {
        const selected = catalog.data?.products.find((p) => String(p.id) === e.target.value)
        onChange({ productId: e.target.value, warehouse: '', ...(selected?.unit === 'kg' ? { unitWeightKg: '1' } : {}) })
      }} className={controlClass}><option value="">Selecionar produto</option>{catalog.data?.products.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}</select>}
    </Field>
    <Field label="Código do lote" error={errors.batchCode}>{(a11y) => <input {...a11y} value={values.batchCode} onChange={(e) => onChange({ batchCode: e.target.value })} maxLength={100} className={controlClass} />}</Field>
    <Field label="Quantidade" error={errors.quantity}>{(a11y) => <input {...a11y} value={values.quantity} onChange={(e) => onChange({ quantity: e.target.value })} inputMode="decimal" className={controlClass} />}</Field>
    <Field label="Peso por unidade (kg)" error={errors.unitWeightKg} hint="Para produtos em kg, informe 1.">{(a11y) => <input {...a11y} value={values.unitWeightKg} onChange={(e) => onChange({ unitWeightKg: e.target.value })} inputMode="decimal" className={controlClass} />}</Field>
    <Field label="Validade" error={errors.expiresAt}>{(a11y) => <input {...a11y} value={values.expiresAt} onChange={(e) => onChange({ expiresAt: e.target.value })} type="date" className={controlClass} />}</Field>
    <Field label="Depósito" error={errors.warehouse}>{(a11y) => <select {...a11y} value={values.warehouse} onChange={(e) => onChange({ warehouse: e.target.value })} className={controlClass}><option value="">Selecionar depósito</option>{catalog.data?.warehouses.filter((w) => w.is_active && (!category?.is_perishable || w.is_cold_storage)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}</Field>
  </div>
}
