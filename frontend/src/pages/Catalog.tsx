import { useState, type FormEvent } from 'react'
import { AsyncBoundary, Button, Card, controlClass, Field, FormError, PageHeader } from '../components/ui'
import { useCatalog, useCreateCategory, useCreateProduct, useCreateWarehouse } from '../hooks/queries'
import { useToast } from '../context/ToastContext'
export default function Catalog() {
  const query = useCatalog()
  const category = useCreateCategory()
  const product = useCreateProduct()
  const warehouse = useCreateWarehouse()
  const toast = useToast()
  const [categoryName, setCategoryName] = useState('')
  const [perishable, setPerishable] = useState(false)
  const [productName, setProductName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [unit, setUnit] = useState('un')
  const [warehouseName, setWarehouseName] = useState('')
  const [cold, setCold] = useState(false)
  const done = () => toast.success('Cadastro salvo.')
  const addCategory = (e: FormEvent) => { e.preventDefault(); category.mutate({ name: categoryName, is_perishable: perishable }, { onSuccess: () => { setCategoryName(''); done() } }) }
  const addProduct = (e: FormEvent) => { e.preventDefault(); product.mutate({ name: productName, category_id: Number(categoryId), unit }, { onSuccess: () => { setProductName(''); done() } }) }
  const addWarehouse = (e: FormEvent) => { e.preventDefault(); warehouse.mutate({ name: warehouseName, is_cold_storage: cold }, { onSuccess: () => { setWarehouseName(''); done() } }) }
  return <>
    <PageHeader title="Cadastros" description="Categorias, produtos e depósitos usados nas doações e no estoque." />
    <AsyncBoundary isPending={query.isPending} isError={query.isError} error={query.error} onRetry={() => void query.refetch()}>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Categorias"><form onSubmit={addCategory} className="space-y-3"><FormError error={category.error} />
          <Field label="Nome da categoria">{(a11y) => <input {...a11y} required value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className={controlClass} />}</Field>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={perishable} onChange={(e) => setPerishable(e.target.checked)} />Exige refrigeração</label><Button type="submit" disabled={category.isPending}>Cadastrar categoria</Button>
        </form><ul className="mt-4 space-y-2 text-sm">{query.data?.categories.map((c) => <li key={c.id}>{c.name}{c.is_perishable ? ' · Refrigerado' : ''}</li>)}</ul></Card>
        <Card title="Produtos"><form onSubmit={addProduct} className="space-y-3"><FormError error={product.error} />
          <Field label="Nome do produto">{(a11y) => <input {...a11y} required value={productName} onChange={(e) => setProductName(e.target.value)} className={controlClass} />}</Field>
          <Field label="Categoria">{(a11y) => <select {...a11y} required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={controlClass}><option value="">Selecionar categoria</option>{query.data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}</Field>
          <Field label="Unidade">{(a11y) => <select {...a11y} value={unit} onChange={(e) => setUnit(e.target.value)} className={controlClass}><option value="un">Unidade</option><option value="kg">Quilograma</option></select>}</Field>
          <Button type="submit" disabled={product.isPending}>Cadastrar produto</Button>
        </form><ul className="mt-4 space-y-2 text-sm">{query.data?.products.map((p) => <li key={p.id}>{p.name} ({p.unit}){!p.is_active ? ' · Inativo' : ''}</li>)}</ul></Card>
        <Card title="Depósitos"><form onSubmit={addWarehouse} className="space-y-3"><FormError error={warehouse.error} />
          <Field label="Nome do depósito">{(a11y) => <input {...a11y} required value={warehouseName} onChange={(e) => setWarehouseName(e.target.value)} className={controlClass} />}</Field>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={cold} onChange={(e) => setCold(e.target.checked)} />Armazenamento refrigerado</label><Button type="submit" disabled={warehouse.isPending}>Cadastrar depósito</Button>
        </form><ul className="mt-4 space-y-2 text-sm">{query.data?.warehouses.map((w) => <li key={w.id}>{w.name}{w.is_cold_storage ? ' · Refrigerado' : ''}{!w.is_active ? ' · Inativo' : ''}</li>)}</ul></Card>
      </div>
    </AsyncBoundary>
  </>
}
