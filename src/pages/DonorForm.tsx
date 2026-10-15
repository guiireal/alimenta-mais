import { useNavigate } from 'react-router-dom'
import { BackLink, Button, Card, controlClass, Field, FormError, LinkButton, PageHeader } from '../components/ui'
import { useToast } from '../context/ToastContext'
import { useCreateDonor } from '../hooks/queries'
import { useForm } from '../lib/hooks'
import { validateDonor, type DonorValues } from '../lib/validators'
import type { DonorType } from '../types'

export default function DonorForm() {
  const navigate = useNavigate()
  const toast = useToast()
  const createDonor = useCreateDonor()
  const form = useForm<DonorValues>({ name: '', type: 'PJ', email: '', phone: '' }, validateDonor)

  const onSubmit = form.submit((v) =>
    createDonor.mutate(
      { name: v.name, type: v.type as DonorType, email: v.email, phone: v.phone },
      { onSuccess: (donor) => { toast.success(`${donor.name} cadastrado.`); navigate(`/doadores/${donor.id}`) } },
    ),
  )

  return (
    <>
      <BackLink to="/doadores">Voltar aos doadores</BackLink>
      <PageHeader title="Novo doador" description="Cadastre quem doa alimentos para a organização." />
      <Card className="max-w-3xl">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormError error={createDonor.error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" error={form.errors.name} className="sm:col-span-2">
              {(a11y) => <input {...a11y} {...form.bind('name')} autoComplete="organization" className={controlClass} />}
            </Field>
            <Field label="Tipo" error={form.errors.type}>
              {(a11y) => (
                <select {...a11y} {...form.bind('type')} className={controlClass}>
                  <option value="PJ">Empresa</option>
                  <option value="PF">Pessoa física</option>
                </select>
              )}
            </Field>
            <Field label="Telefone" error={form.errors.phone} hint="Com DDD">
              {(a11y) => <input {...a11y} {...form.bind('phone')} type="tel" inputMode="tel" autoComplete="tel" className={controlClass} />}
            </Field>
            <Field label="E-mail" error={form.errors.email} className="sm:col-span-2">
              {(a11y) => <input {...a11y} {...form.bind('email')} type="email" autoComplete="email" className={controlClass} />}
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <LinkButton to="/doadores" variant="secondary">Cancelar</LinkButton>
            <Button type="submit" disabled={createDonor.isPending}>{createDonor.isPending ? 'Salvando…' : 'Cadastrar doador'}</Button>
          </div>
        </form>
      </Card>
    </>
  )
}
