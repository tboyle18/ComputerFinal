import { TriangleAlert, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/utils'
import { Button } from './Button'
import { Input } from './Field'

type ModalProps = {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  className?: string
  hideClose?: boolean
}

export function Modal({ open, onClose, title, description, children, className, hideClose }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    const previouslyFocused = document.activeElement as HTMLElement | null
    requestAnimationFrame(() => {
      const el = panelRef.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, button:not([data-close])')
      el?.focus()
    })
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            className={cn(
              'relative w-full max-w-md rounded-t-3xl border border-line bg-surface p-6 shadow-pop sm:rounded-3xl',
              className,
            )}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
          >
            {!hideClose && (
              <button
                data-close
                onClick={onClose}
                className="absolute top-4 right-4 rounded-full p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            )}
            {title && <h2 className="pr-8 text-lg font-semibold tracking-tight">{title}</h2>}
            {description && <div className="mt-1.5 text-sm leading-relaxed text-muted">{description}</div>}
            {children && <div className={cn(title || description ? 'mt-5' : '')}>{children}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

type ConfirmProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  title: string
  description: ReactNode
  confirmLabel?: string
  destructive?: boolean
  /** Require the user to type this text before confirming. */
  confirmText?: string
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = true,
  confirmText,
}: ConfirmProps) {
  const [busy, setBusy] = useState(false)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (open) setTyped('')
  }, [open])

  const handle = async () => {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const blocked = Boolean(confirmText) && typed.trim() !== confirmText

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} hideClose>
      <div className="flex gap-4">
        {destructive && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
            <TriangleAlert className="size-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <div className="mt-1.5 text-sm leading-relaxed text-muted">{description}</div>
          {confirmText && (
            <div className="mt-4">
              <p className="mb-1.5 text-[13px] text-muted">
                Type <span className="font-mono font-medium text-ink">{confirmText}</span> to confirm
              </p>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} data-autofocus autoComplete="off" />
            </div>
          )}
        </div>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant={destructive ? 'danger' : 'primary'} onClick={handle} loading={busy} disabled={blocked}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
