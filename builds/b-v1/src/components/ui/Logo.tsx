import { Link } from 'react-router'
import { cn } from '../../lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-8', className)} aria-hidden>
      <rect width="64" height="64" rx="18" className="fill-ink" />
      <path
        d="M32 12c1.6 9.6 6.4 14.4 16 16-9.6 1.6-14.4 6.4-16 16-1.6-9.6-6.4-14.4-16-16 9.6-1.6 14.4-6.4 16-16Z"
        fill="#c6f15a"
      />
      <circle cx="46" cy="46" r="4" fill="#c6f15a" />
    </svg>
  )
}

export function Logo({ className, to = '/' }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={cn('group inline-flex items-center gap-2', className)} aria-label="Trove home">
      <LogoMark className="transition-transform duration-300 group-hover:rotate-[-8deg]" />
      <span className="font-display text-[28px] leading-none tracking-tight italic">trove</span>
    </Link>
  )
}
