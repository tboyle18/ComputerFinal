import { Search, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { cn } from '../../lib/utils'

export function SearchBar({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const onHome = location.pathname === '/'
  const urlQ = onHome ? (params.get('q') ?? '') : ''
  const [value, setValue] = useState(urlQ)

  useEffect(() => setValue(urlQ), [urlQ])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = new URLSearchParams(onHome ? params : undefined)
    const q = value.trim()
    if (q) next.set('q', q)
    else next.delete('q')
    navigate({ pathname: '/', search: next.toString() ? `?${next}` : '' })
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  const clear = () => {
    setValue('')
    if (onHome && params.has('q')) {
      const next = new URLSearchParams(params)
      next.delete('q')
      navigate({ pathname: '/', search: next.toString() ? `?${next}` : '' })
    }
  }

  return (
    <form onSubmit={submit} role="search" className={cn('group relative w-full', className)}>
      <Search
        className={cn(
          'pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted transition-colors group-focus-within:text-ink',
          size === 'lg' ? 'size-5' : 'size-[18px]',
        )}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search cameras, sofas, sneakers…"
        aria-label="Search listings"
        className={cn(
          'w-full rounded-full border border-line bg-surface pr-11 text-ink shadow-soft outline-none transition placeholder:text-muted/80 hover:border-line-strong focus:border-ink/40 focus:ring-4 focus:ring-ink/5 [&::-webkit-search-cancel-button]:hidden',
          size === 'lg' ? 'h-14 pl-12 text-base' : 'h-11 pl-11 text-[15px]',
        )}
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
    </form>
  )
}
