import { useNavigate } from 'react-router-dom'
import { BackLink, Button, Card, FormError, LinkButton, PageHeader } from '../components/ui'
import { BatchFields } from '../components/BatchFields'
import { useToast } from '../context/ToastContext'
import { useCreateLot } from '../hooks/queries'
import { useForm } from '../lib/hooks'
import { validateLot, type LotValues } from '../lib/validators'
export default function LotForm() {
  const navigate = useNavigate()
  const toast = useToast()
  const create = useCreateLot()
  const form = useForm<LotValues>({ productId: '', batchCode: '', quantity: '', unitWeightKg: '1', expiresAt: '', warehouse: '' }, validateLot)
  const submit = form.submit((v) => create.mutate(v, { onSuccess: (lot) => { toast.success('Lote registrado.'); navigate('/estoque/' + lot.id) } }))
  return <>
    <BackLink to="/estoque">Voltar ao estoque</BackLink>
    <PageHeader title="Novo lote" description="Entrada manual de produtos cadastrados, com validade e depósito de destino." />
    <Card className="max-w-3xl"><form onSubmit={submit} noValidate className="space-y-4">
      <FormError error={create.error} />
      <BatchFields values={form.values} errors={form.errors} onChange={(patch) => { for (const [key, value] of Object.entries(patch)) form.setValue(key as keyof LotValues, value) }} />
      <div className="flex justify-end gap-2"><LinkButton to="/estoque" variant="secondary">Cancelar</LinkButton><Button type="submit" disabled={create.isPending}>{create.isPending ? 'Salvando…' : 'Registrar lote'}</Button></div>
    </form></Card>
  </>
}
