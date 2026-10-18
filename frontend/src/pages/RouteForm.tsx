import { useNavigate } from 'react-router-dom'
import { BackLink, Button, Card, controlClass, Field, FormError, LinkButton, PageHeader } from '../components/ui'
import { useToast } from '../context/ToastContext'
import { useCreateRoute, useCatalog, useUsers } from '../hooks/queries'
import { useForm } from '../lib/hooks'
import { todayInput } from '../lib/utils'
import { validateRoute, type RouteValues } from '../lib/validators'
export default function RouteForm() {
  const navigate = useNavigate()
  const toast = useToast()
  const catalog = useCatalog()
  const users = useUsers()
  const create = useCreateRoute()
  const form = useForm<RouteValues>({ name: '', warehouseId: '', scheduledOn: todayInput(), assignedTo: '' }, validateRoute)
  const submit = form.submit((v) => create.mutate(v, { onSuccess: (route) => { toast.success('Rota criada. Adicione as entregas e seus produtos.'); navigate('/entregas?rota=' + route.id) } }))
  return <>
    <BackLink to="/entregas">Voltar às entregas</BackLink><PageHeader title="Nova rota" description="Defina o depósito de origem, a data e o responsável. As entregas serão adicionadas à rota em seguida." />
    <Card className="max-w-3xl"><form onSubmit={submit} noValidate className="space-y-4">
      <FormError error={create.error || catalog.error || users.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Código da rota" error={form.errors.name}>{(a11y) => <input {...a11y} {...form.bind('name')} className={controlClass} />}</Field>
        <Field label="Data" error={form.errors.scheduledOn}>{(a11y) => <input {...a11y} {...form.bind('scheduledOn')} type="date" className={controlClass} />}</Field>
        <Field label="Depósito de origem" error={form.errors.warehouseId}>{(a11y) => <select {...a11y} {...form.bind('warehouseId')} className={controlClass}><option value="">Selecionar depósito</option>{catalog.data?.warehouses.filter((w) => w.is_active).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}</Field>
        <Field label="Responsável">{(a11y) => <select {...a11y} {...form.bind('assignedTo')} className={controlClass}><option value="">Sem responsável</option>{users.data?.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}</Field>
      </div><div className="flex justify-end gap-2"><LinkButton to="/entregas" variant="secondary">Cancelar</LinkButton><Button type="submit" disabled={create.isPending}>Criar rota</Button></div>
    </form></Card>
  </>
}
