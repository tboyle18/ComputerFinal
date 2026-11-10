import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { cn } from '../../lib/utils'

type DropdownProps = {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  className?: string
}

type Position = { top: number; left?: number; right?: number; up: boolean }

/**
 * Popover menu rendered in a portal with fixed positioning, so it never gets
 * clipped by scrolling or overflow-hidden containers (e.g. tables). It flips
 * upward when there isn't room below the trigger.
 */
export function Dropdown({ trigger, children, align = 'right', className }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Position | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const update = () => {
      const t = triggerRef.current?.getBoundingClientRect()
      if (!t) return
      const menuHeight = menuRef.current?.offsetHeight ?? 0
      const gap = 8
      const up = window.innerHeight - t.bottom < menuHeight + gap * 2 && t.top > menuHeight + gap * 2
      setPos({
        top: up ? t.top - gap - menuHeight : t.bottom + gap,
        left: align === 'left' ? Math.max(8, t.left) : undefined,
        right: align === 'right' ? Math.max(8, window.innerWidth - t.right) : undefined,
        up,
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, align])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <div ref={triggerRef} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              role="menu"
              initial={{ opacity: 0, y: pos?.up ? 6 : -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                top: pos?.top ?? -9999,
                left: pos?.left,
                right: pos?.right,
                visibility: pos ? 'visible' : 'hidden',
              }}
              className={cn(
                'z-[90] min-w-56 rounded-2xl border border-line bg-surface p-1.5 shadow-pop',
                align === 'right' ? 'origin-top-right' : 'origin-top-left',
                className,
              )}
            >
              {children(close)}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

const itemClass =
  'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink [&_svg]:size-4 [&_svg]:text-muted'

export function MenuItem({
  children,
  onClick,
  to,
  danger,
}: {
  children: ReactNode
  onClick?: () => void
  to?: string
  danger?: boolean
}) {
  const cls = cn(itemClass, danger && 'text-danger hover:text-danger [&_svg]:text-danger')
  if (to) {
    return (
      <Link to={to} className={cls} onClick={onClick} role="menuitem">
        {children}
      </Link>
    )
  }
  return (
    <button type="button" className={cls} onClick={onClick} role="menuitem">
      {children}
    </button>
  )
}

export function MenuSeparator() {
  return <div className="my-1.5 h-px bg-line" />
}
