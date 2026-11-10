import { motion } from 'motion/react'
import { useId, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

type Tab<T extends string> = { value: T; label: ReactNode; count?: number }

type TabsProps<T extends string> = {
  tabs: Tab<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/** Segmented control with a sliding pill. */
export function Tabs<T extends string>({ tabs, value, onChange, className }: TabsProps<T>) {
  const id = useId()
  return (
    <div
      role="tablist"
      className={cn('no-scrollbar inline-flex max-w-full overflow-x-auto rounded-full border border-line bg-surface-2/70 p-1', className)}
    >
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative flex h-8 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors',
              active ? 'text-canvas' : 'text-muted hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={`tab-pill-${id}`}
                className="absolute inset-0 rounded-full bg-ink shadow-soft"
                transition={{ type: 'spring', bounce: 0.18, duration: 0.45 }}
              />
            )}
            <span className="relative">{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={cn(
                  'relative rounded-full px-1.5 text-[11px] tabular-nums',
                  active ? 'bg-canvas/15 text-canvas' : 'bg-surface-3 text-muted',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
