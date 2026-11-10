import { LayoutGrid } from 'lucide-react'
import { CATEGORIES } from '../../lib/categories'
import { cn } from '../../lib/utils'

export function CategoryRail({ value, onChange }: { value: string | null; onChange: (slug: string | null) => void }) {
  const items = [{ slug: null as string | null, name: 'All', icon: LayoutGrid }, ...CATEGORIES]
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
      {items.map(({ slug, name, icon: Icon }) => {
        const active = value === slug
        return (
          <button
            key={slug ?? 'all'}
            type="button"
            onClick={() => onChange(slug)}
            aria-pressed={active}
            className={cn(
              'flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all duration-200',
              active
                ? 'border-ink bg-ink text-canvas shadow-soft'
                : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
            )}
          >
            <Icon className="size-4" strokeWidth={1.9} />
            {name}
          </button>
        )
      })}
    </div>
  )
}
