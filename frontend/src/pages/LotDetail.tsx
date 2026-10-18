import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ExpiryBadge } from '../components/ExpiryBadge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ShelfLife } from '../components/ShelfLife'
import { AsyncBoundary, Badge, BackLink, Button, Card, controlClass, Field, FormError, PageHeader, Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useDisposeLot, useLot, useTransferLot } from '../hooks/queries'
import { daysLabel, formatDate, formatDateTime } from '../lib/utils'
import { validateDisposal } from '../lib/validators'
import type { DisposalReason, MovementType, Warehouse } from '../types'

const WAREHOUSES: Warehouse[] = ['Câmara fria', 'Seco A', 'Seco B']
const REASONS: DisposalReason[] = ['Vencimento', 'Avaria', 'Contaminação', 'Outro']
const MOVEMENT_LABEL: Record<MovementType, string> = { entry: 'Entrada', transfer: 'Remanejamento', disposal: 'Baixa' }

export default function LotDetail() {
  const { id = '' } = useParams()
  const { can } = useAuth()
  const toast = useToast()
  const lotQuery = useLot(id)
  const transfer = useTransferLot()
  const dispose = useDisposeLot()
  const [dialog, setDialog] = useState<'transfer' | 'dispose' | null>(null)
  const [warehouse, setWarehouse] = useState<Warehouse | ''>('')
  const [reason, setReason] = useState<DisposalReason | ''>('')
  const [reasonError, setReasonError] = useState<string>()

  const closeDialog = () => {
    setDialog(null)
    setWarehouse('')
    setReason('')
    setReasonError(undefined)
    transfer.reset()
    dispose.reset()
  }

  const confirmTransfer = () => {
    if (!warehouse) return
    transfer.mutate({ id, warehouse }, { onSuccess: () => { toast.success(`Lote remanejado para ${warehouse}.`); closeDialog() } })
  }
  const confirmDispose = () => {
    const error = validateDisposal(reason)
    setReasonError(error)
    if (error || !reason) return
    dispose.mutate({ id, reason }, { onSuccess: () => { toast.success('Baixa registrada.'); closeDialog() } })
  }

  const data = lotQuery.data
  const lot = data?.lot
  const canAct = Boolean(lot && lot.status === 'active')

  return (
    <>
      <BackLink to="/estoque">Voltar ao estoque</BackLink>
      <AsyncBoundary isPending={lotQuery.isPending} isError={lotQuery.isError} error={lotQuery.error} onRetry={() => void lotQuery.refetch()} skeleton={<Skeleton className="h-72" />}>
        {data && lot && (
          <>
            <PageHeader
              title={lot.item}
              description={`Lote ${lot.id}, ${lot.category}`}
              actions={canAct && (
                <>
                  {can('stock:write') && <Button variant="secondary" onClick={() => setDialog('transfer')}>Remanejar</Button>}
                  {can('stock:dispose') && <Button variant="danger" onClick={() => setDialog('dispose')}>Dar baixa</Button>}
                </>
              )}
            />

            {lot.status === 'disposed' && <p role="status" className="rounded-lg bg-cream-100 px-4 py-3 text-sm font-semibold">Este lote recebeu baixa e saiu do estoque. O histórico continua disponível abaixo.</p>}

            <div className="grid gap-4 lg:grid-cols-3">
              <Card title="Dados do lote" className="lg:col-span-2">
                <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  <div><dt className="text-ink-600">Quantidade</dt><dd className="font-bold">{lot.quantity} {lot.unit}</dd></div>
                  <div><dt className="text-ink-600">Depósito</dt><dd className="font-bold">{lot.warehouse}</dd></div>
                  <div><dt className="text-ink-600">Situação</dt><dd>{lot.status === 'disposed' ? <Badge>Baixado</Badge> : <ExpiryBadge expiresAt={lot.expiresAt} />}</dd></div>
                  <div className="col-span-2 sm:col-span-3">
                    <dt className="text-ink-600">Validade</dt>
                    <dd className="font-bold">{lot.expiresAt ? `${formatDate(lot.expiresAt)}, ${daysLabel(lot.expiresAt)}` : 'Não informada'}</dd>
                    <ShelfLife expiresAt={lot.expiresAt} className="mt-2 max-w-md" />
                  </div>
                </dl>
              </Card>

              <Card title="Histórico de movimentações">
                <ol className="space-y-4 border-l-2 border-cream-200 pl-4">
                  {data.movements.map((m) => (
                    <li key={m.id} className="text-sm">
                      <p className="font-semibold">{MOVEMENT_LABEL[m.type]}</p>
                      <p>{m.note}</p>
                      <p className="text-xs text-ink-600">{m.user}, {formatDateTime(m.at)}</p>
                    </li>
                  ))}
                </ol>
              </Card>
            </div>

            <ConfirmDialog open={dialog === 'transfer'} title="Remanejar lote" confirmLabel="Remanejar" pending={transfer.isPending} onConfirm={confirmTransfer} onCancel={closeDialog}>
              <FormError error={transfer.error} />
              <Field label="Novo depósito">
                {(a11y) => (
                  <select {...a11y} value={warehouse} onChange={(e) => setWarehouse(e.target.value as Warehouse | '')} className={controlClass}>
                    <option value="">Selecionar depósito</option>
                    {WAREHOUSES.filter((w) => w !== lot.warehouse).map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                )}
              </Field>
            </ConfirmDialog>

            <ConfirmDialog open={dialog === 'dispose'} title="Dar baixa neste lote?" confirmLabel="Dar baixa" danger pending={dispose.isPending} onConfirm={confirmDispose} onCancel={closeDialog}>
              <p>O lote sai do estoque e a baixa fica registrada na auditoria. Essa ação não pode ser desfeita.</p>
              <FormError error={dispose.error} />
              <Field label="Motivo da baixa" error={reasonError}>
                {(a11y) => (
                  <select {...a11y} value={reason} onChange={(e) => setReason(e.target.value as DisposalReason | '')} className={controlClass}>
                    <option value="">Selecionar motivo</option>
                    {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                )}
              </Field>
            </ConfirmDialog>
          </>
        )}
      </AsyncBoundary>
    </>
  )
}
