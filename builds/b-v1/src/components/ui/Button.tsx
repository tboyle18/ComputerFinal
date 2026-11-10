import { LoaderCircle } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Link } from 'react-router'
import { cn } from '../../lib/utils'

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'soft' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

const base =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all duration-200 select-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:shrink-0'

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-canvas hover:bg-ink/85 shadow-soft',
  accent: 'bg-accent text-accent-ink hover:bg-accent-strong shadow-soft',
  outline: 'border border-line-strong bg-surface text-ink hover:bg-surface-2 hover:border-ink/25',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  soft: 'bg-surface-2 text-ink hover:bg-surface-3',
  danger: 'bg-danger text-white hover:bg-danger/90 shadow-soft',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-[13px] [&_svg]:size-3.5',
  md: 'h-10 px-5 text-sm [&_svg]:size-4',
  lg: 'h-12 px-6 text-[15px] [&_svg]:size-[18px]',
  icon: 'size-10 [&_svg]:size-[18px]',
  'icon-sm': 'size-8 [&_svg]:size-4',
}

export function buttonStyles(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className)
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={buttonStyles(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <LoaderCircle className="animate-spin" />
        </span>
      )}
      <span className={cn('inline-flex items-center justify-center gap-2', loading && 'invisible')}>{children}</span>
    </button>
  )
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size }

export function ButtonLink({ variant = 'primary', size = 'md', className, ...props }: ButtonLinkProps) {
  return <Link className={buttonStyles(variant, size, className)} {...props} />
}
