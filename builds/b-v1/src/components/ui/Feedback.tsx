import { LoaderCircle, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('size-5 animate-spin text-muted', className)} />
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="size-6" />
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-xl', className)} />
}

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-3xl border border-dashed border-line-strong bg-surface/50 px-6 py-16 text-center',
        className,
      )}
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 scale-150 rounded-full bg-accent/30 blur-2xl" />
        <div className="relative flex size-14 items-center justify-center rounded-2xl border border-line bg-surface shadow-soft">
          <Icon className="size-6 text-ink" strokeWidth={1.75} />
        </div>
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'ink'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-2 border-line',
  accent: 'bg-accent text-accent-ink border-transparent',
  success: 'bg-success/12 text-success border-success/20',
  warning: 'bg-warning/12 text-warning border-warning/25',
  danger: 'bg-danger/10 text-danger border-danger/20',
  ink: 'bg-ink text-canvas border-transparent',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
