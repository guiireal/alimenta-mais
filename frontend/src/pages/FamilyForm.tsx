import { useNavigate } from 'react-router-dom'
import { BackLink, Button, Card, controlClass, Field, FormError, LinkButton, PageHeader } from '../components/ui'
import { useToast } from '../context/ToastContext'
import { useCreateFamily } from '../hooks/queries'
import { useForm } from '../lib/hooks'
import { validateFamily, type FamilyValues } from '../lib/validators'
export default function FamilyForm() {
  const navigate = useNavigate()
  const toast = useToast()
  const create = useCreateFamily()
  const form = useForm<FamilyValues>({ code: '', contactName: '', address: '', neighborhood: '', city: '', state: 'SP', members: '' }, validateFamily)
  const fields: { key: keyof FamilyValues; label: string }[] = [
    { key: 'code', label: 'Código de referência' }, { key: 'contactName', label: 'Nome do responsável' },
    { key: 'address', label: 'Endereço completo' }, { key: 'neighborhood', label: 'Bairro' },
    { key: 'city', label: 'Cidade' }, { key: 'state', label: 'UF' }, { key: 'members', label: 'Pessoas na família' },
  ]
  const submit = form.submit((v) => create.mutate({ ...v, members: Number(v.members) }, { onSuccess: (family) => { toast.success('Família cadastrada. Registre o consentimento recebido.'); navigate('/familias/' + family.id) } }))
  return <>
    <BackLink to="/familias">Voltar às famílias</BackLink>
    <PageHeader title="Cadastrar família" description="Após salvar, registre o consentimento recebido para habilitar as entregas." />
    <Card className="max-w-3xl"><form onSubmit={submit} noValidate className="space-y-4">
      <FormError error={create.error} /><div className="grid gap-4 sm:grid-cols-2">
        {fields.map(({ key, label }) => <Field key={key} label={label} error={form.errors[key]}>{(a11y) => <input {...a11y} {...form.bind(key)} type={key === 'members' ? 'number' : 'text'} className={controlClass} />}</Field>)}
      </div><div className="flex justify-end gap-2"><LinkButton to="/familias" variant="secondary">Cancelar</LinkButton><Button type="submit" disabled={create.isPending}>Salvar cadastro</Button></div>
    </form></Card>
  </>
}
