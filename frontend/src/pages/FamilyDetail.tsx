import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AsyncBoundary, Badge, BackLink, Button, Card, FormError, PageHeader, Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useFamily, useSetConsent } from '../hooks/queries'
import { formatDate } from '../lib/utils'

export default function FamilyDetail() {
  const { id = '' } = useParams()
  const { can } = useAuth()
  const toast = useToast()
  const query = useFamily(id)
  const setConsent = useSetConsent()
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const family = query.data

  const change = (granted: boolean) =>
    setConsent.mutate({ id, granted }, {
      onSuccess: () => { toast.success(granted ? 'Consentimento registrado.' : 'Consentimento revogado.'); setConfirmRevoke(false) },
    })

  return (
    <>
      <BackLink to="/familias">Voltar às famílias</BackLink>
      <AsyncBoundary isPending={query.isPending} isError={query.isError} error={query.error} onRetry={() => void query.refetch()} skeleton={<Skeleton className="h-56" />}>
        {family && (
          <>
            <PageHeader
              title={`Família ${family.code}`}
              description={family.neighborhood}
              actions={can('family:write') && (family.consent === 'granted'
                ? <Button variant="secondary" onClick={() => setConfirmRevoke(true)}>Revogar consentimento</Button>
                : <Button onClick={() => change(true)} disabled={setConsent.isPending}>Registrar consentimento</Button>)}
            />
            <FormError error={!confirmRevoke ? setConsent.error : null} />
            <Card title="Resumo">
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div><dt className="text-ink-600">Responsável</dt><dd className="font-bold">{family.contactName}</dd></div>
                <div><dt className="text-ink-600">Endereço</dt><dd>{family.address}, {family.city}/{family.state}</dd></div>
                <div><dt className="text-ink-600">Pessoas</dt><dd className="font-bold">{family.members}</dd></div>
                <div><dt className="text-ink-600">Consentimento LGPD</dt><dd><Badge tone={family.consent === 'granted' ? 'green' : 'orange'}>{family.consent === 'granted' ? 'Consentimento ok' : 'Pendente'}</Badge></dd></div>
                <div><dt className="text-ink-600">Última entrega</dt><dd className="font-bold">{family.lastDeliveryAt ? formatDate(family.lastDeliveryAt) : 'Sem entregas'}</dd></div>
              </dl>
              {family.consent !== 'granted' && <p className="mt-4 text-sm text-ink-600">Sem consentimento, esta família não pode ser incluída em rotas de entrega.</p>}
            </Card>

            <ConfirmDialog open={confirmRevoke} title="Revogar consentimento?" confirmLabel="Revogar" danger pending={setConsent.isPending} onConfirm={() => change(false)} onCancel={() => { setConfirmRevoke(false); setConsent.reset() }}>
              <p>A família deixa de poder receber entregas até um novo consentimento. A revogação fica registrada na auditoria.</p>
              <FormError error={setConsent.error} />
            </ConfirmDialog>
          </>
        )}
      </AsyncBoundary>
    </>
  )
}
