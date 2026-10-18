import { useNavigate } from 'react-router-dom'
import { AsyncBoundary, BackLink, Button, Card, controlClass, Field, FormError, LinkButton, PageHeader, Skeleton } from '../components/ui'
import { useToast } from '../context/ToastContext'
import { useCreateRoute, useFamilies } from '../hooks/queries'
import { useForm } from '../lib/hooks'
import { validateRoute, type RouteValues } from '../lib/validators'

const VEHICLES = ['Van 01', 'Van 02', 'Carro 01']
const TEAMS = ['Equipe A', 'Equipe B', 'Equipe C']

export default function RouteForm() {
  const navigate = useNavigate()
  const toast = useToast()
  const families = useFamilies()
  const createRoute = useCreateRoute()
  const form = useForm<RouteValues>({ name: '', vehicle: '', driver: '', startTime: '09:00', familyIds: [] }, validateRoute)

  const toggleFamily = (id: string, checked: boolean) =>
    form.setValue('familyIds', checked ? [...form.values.familyIds, id] : form.values.familyIds.filter((f) => f !== id))

  const onSubmit = form.submit((v) =>
    createRoute.mutate(v, { onSuccess: (route) => { toast.success(`${route.name} criada com ${route.stops.length} paradas.`); navigate(`/entregas?rota=${route.id}`) } }),
  )

  return (
    <>
      <BackLink to="/entregas">Voltar às entregas</BackLink>
      <PageHeader title="Nova rota" description="Escolha a equipe, o veículo e as famílias. Só famílias com consentimento LGPD podem entrar." />
      <Card className="max-w-3xl">
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <FormError error={createRoute.error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da rota" error={form.errors.name} className="sm:col-span-2">
              {(a11y) => <input {...a11y} {...form.bind('name')} placeholder="Ex.: Rota 03, zona norte" className={controlClass} />}
            </Field>
            <Field label="Veículo" error={form.errors.vehicle}>
              {(a11y) => <select {...a11y} {...form.bind('vehicle')} className={controlClass}><option value="">Selecionar veículo</option>{VEHICLES.map((v) => <option key={v}>{v}</option>)}</select>}
            </Field>
            <Field label="Equipe" error={form.errors.driver}>
              {(a11y) => <select {...a11y} {...form.bind('driver')} className={controlClass}><option value="">Selecionar equipe</option>{TEAMS.map((t) => <option key={t}>{t}</option>)}</select>}
            </Field>
            <Field label="Saída do depósito" error={form.errors.startTime}>
              {(a11y) => <input {...a11y} {...form.bind('startTime')} type="time" className={`${controlClass} sm:max-w-40`} />}
            </Field>
          </div>

          <fieldset aria-describedby={form.errors.familyIds ? 'familias-erro' : undefined}>
            <legend className="mb-2 text-sm font-semibold text-ink-600">Famílias na rota</legend>
            <AsyncBoundary isPending={families.isPending} isError={families.isError} error={families.error} onRetry={() => void families.refetch()} skeleton={<Skeleton className="h-32" />}>
              <ul className="grid gap-2 sm:grid-cols-2">
                {families.data?.map((f) => {
                  const blocked = f.consent !== 'granted'
                  return (
                    <li key={f.id}>
                      <label className={`flex items-center gap-3 rounded-lg border border-cream-200 px-3 py-2 text-sm ${blocked ? 'opacity-60' : 'hover:bg-cream-100'}`}>
                        <input type="checkbox" disabled={blocked} checked={form.values.familyIds.includes(f.id)} onChange={(e) => toggleFamily(f.id, e.target.checked)} className="size-4 accent-leaf-600" />
                        <span><span className="font-bold">{f.code}</span>, {f.neighborhood}{blocked && <span className="block text-xs text-ink-600">Aguardando consentimento LGPD</span>}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </AsyncBoundary>
            {form.errors.familyIds && <p id="familias-erro" role="alert" className="mt-2 text-sm font-semibold text-tomato-600">{form.errors.familyIds}</p>}
          </fieldset>

          <div className="flex justify-end gap-2">
            <LinkButton to="/entregas" variant="secondary">Cancelar</LinkButton>
            <Button type="submit" disabled={createRoute.isPending}>{createRoute.isPending ? 'Gerando…' : 'Gerar rota'}</Button>
          </div>
        </form>
      </Card>
    </>
  )
}
