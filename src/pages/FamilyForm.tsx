import { useNavigate } from 'react-router-dom'
import { BackLink, Button, Card, controlClass, Field, FormError, LinkButton, PageHeader } from '../components/ui'
import { useToast } from '../context/ToastContext'
import { useCreateFamily } from '../hooks/queries'
import { useForm } from '../lib/hooks'
import { validateFamily, type FamilyValues } from '../lib/validators'

export default function FamilyForm() {
  const navigate = useNavigate()
  const toast = useToast()
  const createFamily = useCreateFamily()
  const form = useForm<FamilyValues>({ neighborhood: '', members: '', consent: false }, validateFamily)

  const onSubmit = form.submit((v) =>
    createFamily.mutate(
      { neighborhood: v.neighborhood, members: Number(v.members), consent: v.consent },
      { onSuccess: (family) => { toast.success(`Família ${family.code} cadastrada.`); navigate(`/familias/${family.id}`) } },
    ),
  )

  return (
    <>
      <BackLink to="/familias">Voltar às famílias</BackLink>
      <PageHeader title="Cadastrar família" description="Colete só o necessário para a entrega. Sem consentimento, a família não entra em rotas." />
      <Card className="max-w-3xl">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError error={createFamily.error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bairro" error={form.errors.neighborhood}>
              {(a11y) => <input {...a11y} {...form.bind('neighborhood')} className={controlClass} />}
            </Field>
            <Field label="Pessoas na família" error={form.errors.members}>
              {(a11y) => <input {...a11y} {...form.bind('members')} type="number" min={1} max={20} inputMode="numeric" className={controlClass} />}
            </Field>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={form.values.consent} onChange={(e) => form.setValue('consent', e.target.checked)} className="mt-0.5 size-4 accent-leaf-600" />
            <span><span className="font-bold">Consentimento LGPD recebido</span><br /><span className="text-ink-600">A família autorizou o uso dos dados para organizar entregas.</span></span>
          </label>
          <div className="flex justify-end gap-2">
            <LinkButton to="/familias" variant="secondary">Cancelar</LinkButton>
            <Button type="submit" disabled={createFamily.isPending}>{createFamily.isPending ? 'Salvando…' : 'Salvar cadastro'}</Button>
          </div>
        </form>
      </Card>
    </>
  )
}
