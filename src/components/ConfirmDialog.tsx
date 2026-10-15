import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './ui'

/** Diálogo modal nativo (<dialog>): o navegador cuida do foco, do Esc e do fundo inerte. */
export function ConfirmDialog({ open, title, confirmLabel, pending = false, danger = false, onConfirm, onCancel, children }: {
  open: boolean; title: string; confirmLabel: string; pending?: boolean; danger?: boolean
  onConfirm: () => void; onCancel: () => void; children?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onCancel}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl p-0 text-ink-900 backdrop:bg-ink-900/50"
    >
      <form onSubmit={(e) => { e.preventDefault(); onConfirm() }} className="p-5">
        <h2 id={titleId} className="text-lg font-extrabold">{title}</h2>
        <div className="mt-2 space-y-3 text-sm">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={pending}>{pending ? 'Aguarde…' : confirmLabel}</Button>
        </div>
      </form>
    </dialog>
  )
}
