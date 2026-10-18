import { Check } from 'lucide-react'
import { AsyncBoundary, Badge, Button, Card, controlClass, PageHeader, Skeleton, TableScroll, tdClass, thClass } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useAudit, useUpdateUser, useUsers } from '../hooks/queries'
import { PERMISSION_LABEL, ROLE_LABEL, ROLE_PERMISSIONS } from '../lib/permissions'
import { errorMessage, formatDateTime } from '../lib/utils'
import type { Permission, Role } from '../types'

const ROLES = Object.keys(ROLE_LABEL) as Role[]
const PERMISSIONS = Object.keys(PERMISSION_LABEL) as Permission[]

export default function Access() {
  const { user: me, can } = useAuth()
  const toast = useToast()
  const users = useUsers()
  const audit = useAudit()
  const update = useUpdateUser()
  const canEdit = can('access:write')

  const apply = (id: string, patch: { role?: Role; active?: boolean }, message: string) => {
    if (!me) return
    update.mutate({ id, patch, actorId: me.id }, { onSuccess: () => toast.success(message), onError: (e) => toast.error(errorMessage(e)) })
  }

  return (
    <>
      <PageHeader title="Acessos e auditoria" description="Quem pode ver e alterar cada módulo, e o que foi feito no sistema." />

      <div className="grid gap-4 xl:grid-cols-5">
        <Card title="Usuários" className="xl:col-span-3">
          <AsyncBoundary isPending={users.isPending} isError={users.isError} error={users.error} onRetry={() => void users.refetch()} skeleton={<Skeleton className="h-56" />}>
            <TableScroll minWidth="min-w-[560px]">
              <thead>
                <tr><th className={thClass}>Nome</th><th className={thClass}>Perfil</th><th className={thClass}>Situação</th>{canEdit && <th className={thClass}><span className="sr-only">Ação</span></th>}</tr>
              </thead>
              <tbody>
                {users.data?.map((u) => {
                  const self = u.id === me?.id
                  return (
                    <tr key={u.id}>
                      <td className={tdClass}><p className="font-semibold">{u.name}{self && ' (você)'}</p><p className="text-xs text-ink-600">{u.email}</p></td>
                      <td className={tdClass}>
                        {canEdit && !self ? (
                          <select aria-label={`Perfil de ${u.name}`} value={u.role} onChange={(e) => apply(u.id, { role: e.target.value as Role }, `Perfil de ${u.name} alterado.`)} className={`${controlClass} h-9 w-40`}>
                            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                          </select>
                        ) : <Badge tone={u.role === 'manager' ? 'green' : 'neutral'}>{ROLE_LABEL[u.role]}</Badge>}
                      </td>
                      <td className={tdClass}><Badge tone={u.active ? 'green' : 'neutral'}>{u.active ? 'Ativo' : 'Inativo'}</Badge></td>
                      {canEdit && (
                        <td className={tdClass}>
                          {!self && <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => apply(u.id, { active: !u.active }, u.active ? `${u.name} desativado.` : `${u.name} reativado.`)}>{u.active ? 'Desativar' : 'Reativar'}</Button>}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </TableScroll>
          </AsyncBoundary>
        </Card>

        <Card title="Trilha de auditoria" className="xl:col-span-2">
          <AsyncBoundary isPending={audit.isPending} isError={audit.isError} error={audit.error} onRetry={() => void audit.refetch()} skeleton={<Skeleton className="h-56" />}>
            <ol className="max-h-96 space-y-4 overflow-y-auto border-l-2 border-cream-200 pl-4">
              {audit.data?.map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="font-semibold">{a.action}</p>
                  <p className="text-xs text-ink-600">{a.user}, {formatDateTime(a.at)}, referente a {a.entity}</p>
                </li>
              ))}
            </ol>
          </AsyncBoundary>
        </Card>
      </div>

      <Card title="O que cada perfil pode fazer">
        <TableScroll minWidth="min-w-[560px]">
          <thead>
            <tr><th className={thClass}>Permissão</th>{ROLES.map((r) => <th key={r} className={`${thClass} text-center`}>{ROLE_LABEL[r]}</th>)}</tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p}>
                <td className={tdClass}>{PERMISSION_LABEL[p]}</td>
                {ROLES.map((r) => (
                  <td key={r} className={`${tdClass} text-center`}>
                    {ROLE_PERMISSIONS[r].includes(p) ? <><Check size={16} className="mx-auto text-leaf-600" aria-hidden="true" /><span className="sr-only">Sim</span></> : <span className="text-ink-600"><span aria-hidden="true">-</span><span className="sr-only">Não</span></span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </TableScroll>
      </Card>
    </>
  )
}
