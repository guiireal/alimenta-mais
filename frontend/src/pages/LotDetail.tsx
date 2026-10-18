import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ExpiryBadge } from '../components/ExpiryBadge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AsyncBoundary, BackLink, Button, Card, controlClass, Field, FormError, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useCatalog, useDisposeLot, useLot, useTransferLot } from '../hooks/queries'
import { formatDate, formatDateTime } from '../lib/utils'
import { decimalProblem } from '../lib/validators'
import type { DisposalReason, MovementType } from '../types'

const REASONS: DisposalReason[] = ['Vencimento', 'Avaria', 'Contaminação', 'Outro']
const LABELS: Record<MovementType, string> = { entry: 'Entrada', transfer: 'Remanejamento', expiration_loss: 'Perda por vencimento', other_loss: 'Outra perda', distribution: 'Distribuição', return: 'Devolução', adjustment_out: 'Ajuste de saída' }
export default function LotDetail() {
  const { id = '' } = useParams()
  const { can } = useAuth()
  const toast = useToast()
  const query = useLot(id)
  const catalog = useCatalog()
  const transfer = useTransferLot()
  const dispose = useDisposeLot()
  const [dialog, setDialog] = useState<'transfer' | 'dispose' | null>(null)
  const [fromWarehouse, setFrom] = useState('')
  const [warehouse, setWarehouse] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState<DisposalReason>('Vencimento')
  const [error, setError] = useState<unknown>(null)
  const lot = query.data?.lot
  const close = () => { setDialog(null); setFrom(''); setWarehouse(''); setQuantity(''); setError(null); transfer.reset(); dispose.reset() }
  const confirm = () => {
    const problem = decimalProblem(quantity)
    if (!fromWarehouse || problem || dialog === 'transfer' && (!warehouse || warehouse === fromWarehouse)) { setError(new Error(problem ?? 'Selecione os depósitos de origem e destino.')); return }
    const success = () => { toast.success('Movimentação registrada.'); close() }
    if (dialog === 'transfer') transfer.mutate({ id, fromWarehouse, warehouse, quantity }, { onSuccess: success })
    else dispose.mutate({ id, fromWarehouse, quantity, reason }, { onSuccess: success })
  }
  return <>
    <BackLink to="/estoque">Voltar ao estoque</BackLink>
    <AsyncBoundary isPending={query.isPending} isError={query.isError} error={query.error} onRetry={() => void query.refetch()}>
      {lot && query.data && <>
        <PageHeader title={lot.item} description={'Lote ' + lot.batchCode + ' · ' + lot.category} actions={lot.quantity > 0 && <>
          {can('stock:write') && <Button variant="secondary" onClick={() => setDialog('transfer')}>Remanejar</Button>}
          {can('stock:dispose') && <Button variant="danger" onClick={() => setDialog('dispose')}>Dar baixa</Button>}
        </>} />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Saldo do lote"><dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt>Quantidade disponível</dt><dd className="font-bold">{lot.quantity} {lot.unit}</dd></div>
            <div><dt>Validade</dt><dd>{lot.expiresAt ? formatDate(lot.expiresAt) : 'Não informada'} <ExpiryBadge expiresAt={lot.expiresAt} /></dd></div>
          </dl><ul className="mt-4 space-y-2 text-sm">{lot.balances.map((b) => <li key={b.warehouseId}>{b.warehouseName}: <strong>{b.quantity} {lot.unit}</strong></li>)}</ul>
            {lot.quantity === 0 && <p className="mt-3 text-sm">Este lote está sem saldo. O histórico permanece disponível.</p>}
          </Card>
          <Card title="Histórico de movimentações"><ol className="space-y-4 border-l-2 border-cream-200 pl-4">
            {query.data.movements.map((m) => <li key={m.id} className="text-sm"><p className="font-bold">{LABELS[m.type]}</p><p>{m.note}</p><p className="text-xs text-ink-600">{m.user} · {formatDateTime(m.at)}</p></li>)}
          </ol></Card>
        </div>
        <ConfirmDialog open={dialog !== null} title={dialog === 'transfer' ? 'Remanejar quantidade' : 'Registrar perda'} confirmLabel="Confirmar movimentação" danger={dialog === 'dispose'} pending={transfer.isPending || dispose.isPending} onConfirm={confirm} onCancel={close}>
          <FormError error={error || transfer.error || dispose.error || catalog.error} />
          <Field label="Depósito de origem">{(a11y) => <select {...a11y} value={fromWarehouse} onChange={(e) => setFrom(e.target.value)} className={controlClass}><option value="">Selecionar origem</option>{lot.balances.map((b) => <option key={b.warehouseId} value={b.warehouseId}>{b.warehouseName} · {b.quantity} {lot.unit}</option>)}</select>}</Field>
          <Field label="Quantidade">{(a11y) => <input {...a11y} value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" className={controlClass} />}</Field>
          {dialog === 'transfer' ? <Field label="Depósito de destino">{(a11y) => <select {...a11y} value={warehouse} onChange={(e) => setWarehouse(e.target.value)} className={controlClass}><option value="">Selecionar destino</option>{catalog.data?.warehouses.filter((w) => w.is_active && String(w.id) !== fromWarehouse).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}</Field>
            : <><p className="text-sm">A perda reduz o saldo informado e fica registrada na auditoria.</p><Field label="Motivo">{(a11y) => <select {...a11y} value={reason} onChange={(e) => setReason(e.target.value as DisposalReason)} className={controlClass}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>}</Field></>}
        </ConfirmDialog>
      </>}
    </AsyncBoundary>
  </>
}
