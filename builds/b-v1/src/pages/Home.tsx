import {
  ArrowRight,
  Camera,
  MessageCircle,
  PackageSearch,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageContainer } from '../components/layout/Layout'
import { SearchBar } from '../components/layout/SearchBar'
import { CategoryRail } from '../components/listings/CategoryRail'
import { ListingGrid } from '../components/listings/ListingCard'
import { ListingImage } from '../components/listings/ListingImage'
import { Button, ButtonLink } from '../components/ui/Button'
import { Dropdown } from '../components/ui/Dropdown'
import { EmptyState, Skeleton } from '../components/ui/Feedback'
import { Input, Select } from '../components/ui/Field'
import { useAuth } from '../context/AuthContext'
import { getCategory } from '../lib/categories'
import { supabase } from '../lib/supabase'
import { LISTING_CARD_SELECT, type ListingWithSeller } from '../lib/types'
import { CONDITIONS, cn, formatPrice, sanitizeSearch } from '../lib/utils'

const PAGE_SIZE = 20

type Sort = 'newest' | 'price_asc' | 'price_desc'
const SORTS: { value: Sort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
]

const POPULAR = ['Camera', 'Sofa', 'Sneakers', 'Vinyl', 'Guitar', 'Switch']

type Filters = {
  q: string
  category: string | null
  sort: Sort
  min: string
  max: string
  conditions: string[]
}

function readFilters(params: URLSearchParams): Filters {
  const sort = params.get('sort') as Sort | null
  return {
    q: params.get('q')?.trim() ?? '',
    category: params.get('category'),
    sort: sort && SORTS.some((s) => s.value === sort) ? sort : 'newest',
    min: params.get('min') ?? '',
    max: params.get('max') ?? '',
    conditions: params.get('condition')?.split(',').filter(Boolean) ?? [],
  }
}

export default function Home() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => readFilters(params), [params])
  const filterKey = JSON.stringify(filters)

  const [listings, setListings] = useState<ListingWithSeller[]>([])
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const requestId = useRef(0)

  const hasFilters = Boolean(filters.q || filters.category || filters.min || filters.max || filters.conditions.length)

  const fetchPage = useCallback(
    async (page: number) => {
      const id = ++requestId.current
      if (page === 0) setLoading(true)
      else setLoadingMore(true)

      let query = supabase.from('listings').select(LISTING_CARD_SELECT, { count: 'exact' }).eq('status', 'active')

      if (filters.category) query = query.eq('category', filters.category)
      const q = sanitizeSearch(filters.q)
      if (q) query = query.or(`title.ilike.*${q}*,description.ilike.*${q}*`)
      if (filters.min && !Number.isNaN(Number(filters.min))) query = query.gte('price', Number(filters.min))
      if (filters.max && !Number.isNaN(Number(filters.max))) query = query.lte('price', Number(filters.max))
      if (filters.conditions.length) query = query.in('condition', filters.conditions)

      if (filters.sort === 'price_asc') query = query.order('price', { ascending: true })
      else if (filters.sort === 'price_desc') query = query.order('price', { ascending: false })
      query = query.order('created_at', { ascending: false })

      const from = page * PAGE_SIZE
      const { data, count: total, error } = await query.range(from, from + PAGE_SIZE - 1)

      if (id !== requestId.current) return // a newer request superseded this one
      if (!error) {
        const rows = (data ?? []) as unknown as ListingWithSeller[]
        setListings((prev) => (page === 0 ? rows : [...prev, ...rows]))
        setCount(total ?? 0)
      }
      setLoading(false)
      setLoadingMore(false)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterKey],
  )

  useEffect(() => {
    fetchPage(0)
  }, [fetchPage])

  const update = (patch: Partial<Record<'q' | 'category' | 'sort' | 'min' | 'max' | 'condition', string | null>>) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === '' || (k === 'sort' && v === 'newest')) next.delete(k)
      else next.set(k, v)
    })
    setParams(next, { preventScrollReset: true })
  }

  const heading = filters.q
    ? `Results for “${filters.q}”`
    : filters.category
      ? getCategory(filters.category).name
      : 'Fresh finds'

  const page = Math.ceil(listings.length / PAGE_SIZE)
  const hasMore = count !== null && listings.length < count

  return (
    <PageContainer className="pt-4 sm:pt-6">
      {!hasFilters && <Hero liveCount={count} />}

      <section id="browse" className={cn('scroll-mt-24', hasFilters ? 'mt-2' : 'mt-12')}>
        <CategoryRail value={filters.category} onChange={(slug) => update({ category: slug })} />

        <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{heading}</h2>
            <p className="mt-1 text-sm text-muted">
              {loading && count === null ? 'Loading…' : `${(count ?? 0).toLocaleString()} ${count === 1 ? 'item' : 'items'} available`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FiltersMenu filters={filters} onApply={update} />
            <div className="w-48">
              <Select
                value={filters.sort}
                onChange={(e) => update({ sort: e.target.value })}
                aria-label="Sort listings"
                className="h-10 rounded-full text-sm"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <ActiveFilters filters={filters} onUpdate={update} onClear={() => setParams(new URLSearchParams())} />

        <div className="mt-6">
          {!loading && listings.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="Nothing here yet"
              description={
                hasFilters
                  ? 'No listings match those filters. Try a broader search or a different category.'
                  : 'Be the first to list something on Trove.'
              }
              action={
                hasFilters ? (
                  <Button variant="outline" onClick={() => setParams(new URLSearchParams())}>
                    Clear filters
                  </Button>
                ) : (
                  <ButtonLink to="/sell" variant="accent">
                    List an item
                  </ButtonLink>
                )
              }
            />
          ) : (
            <ListingGrid listings={listings} loading={loading || loadingMore} skeletons={loading ? 10 : 5} />
          )}
        </div>

        {hasMore && !loading && (
          <div className="mt-12 flex justify-center">
            <Button variant="outline" size="lg" onClick={() => fetchPage(page)} loading={loadingMore}>
              Show more
            </Button>
          </div>
        )}
      </section>

      {!hasFilters && <ValueProps />}
    </PageContainer>
  )
}

/* -------------------------------------------------------------------------- */

function useFeatured() {
  const [items, setItems] = useState<ListingWithSeller[] | null>(null)
  useEffect(() => {
    supabase
      .from('listings')
      .select(LISTING_CARD_SELECT)
      .eq('status', 'active')
      .filter('images', 'neq', '{}')
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setItems((data ?? []) as unknown as ListingWithSeller[]))
  }, [])
  return items
}

function Hero({ liveCount }: { liveCount: number | null }) {
  const featured = useFeatured()
  const { user } = useAuth()
  const [, setParams] = useSearchParams()

  const positions = [
    { className: 'top-0 left-0 w-48 xl:left-4', r: '-6deg', delay: 0.15, anim: 'animate-float' },
    { className: 'top-12 right-0 w-52 xl:right-4', r: '5deg', delay: 0.3, anim: 'animate-float-slow' },
    { className: 'bottom-0 left-[30%] w-44 z-10', r: '-2deg', delay: 0.45, anim: 'animate-float' },
  ]

  return (
    <section className="hero-glow relative overflow-hidden rounded-[28px] text-white shadow-pop sm:rounded-[36px]">
      <div className="dotted-bg absolute inset-0" />
      <div className="relative grid items-center gap-10 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1.15fr_1fr] lg:px-14 lg:py-20">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pr-3 pl-1.5 text-[13px] text-white/80 backdrop-blur"
          >
            <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
              <Sparkles className="size-3" /> New
            </span>
            Pre-loved, well-loved, ready for round two
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 text-[44px] leading-[0.98] font-semibold tracking-[-0.035em] sm:text-6xl lg:text-[76px]"
          >
            Find something
            <br />
            <span className="font-display font-normal tracking-[-0.01em] text-accent italic">worth keeping.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.6 }}
            className="mt-5 max-w-md text-[15px] leading-relaxed text-white/65 sm:text-base"
          >
            Trove is the calm marketplace for second-hand gems — from film cameras to mid-century sofas. List in a minute,
            chat with sellers, check out in seconds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.6 }}
            className="mt-8 max-w-lg text-ink"
          >
            <SearchBar size="lg" className="hidden md:block" />
            <div className="flex flex-wrap items-center gap-2 text-[13px] md:mt-4">
              <span className="text-white/45">Popular:</span>
              {POPULAR.map((term) => (
                <button
                  key={term}
                  onClick={() => setParams({ q: term })}
                  className="rounded-full border border-white/12 px-3 py-1 text-white/75 transition hover:border-white/30 hover:bg-white/5 hover:text-white"
                >
                  {term}
                </button>
              ))}
            </div>
          </motion.div>

          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/60">
            <span className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              {liveCount === null ? 'Loading live listings…' : `${liveCount.toLocaleString()} items live right now`}
            </span>
            {!user && (
              <Link to="/signup" className="group inline-flex items-center gap-1.5 font-medium text-white hover:text-accent">
                Start selling for free
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        </div>

        <div className="relative hidden h-[470px] lg:block" aria-hidden>
          {positions.map((pos, i) => {
            const item = featured?.[i]
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30, rotate: 0 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: pos.delay, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className={cn('absolute', pos.className)}
              >
                <div className={pos.anim} style={{ ['--r' as string]: pos.r }}>
                  {item ? (
                    <Link
                      to={`/listing/${item.id}`}
                      tabIndex={-1}
                      className="block rounded-3xl bg-white p-2.5 text-neutral-900 shadow-pop transition-transform duration-300 hover:scale-[1.03]"
                    >
                      <ListingImage path={item.images[0]} alt={item.title} category={item.category} width={500} className="aspect-[4/5] rounded-2xl" eager />
                      <div className="flex items-center justify-between gap-2 px-1.5 pt-2.5 pb-1">
                        <span className="truncate text-[13px] font-medium">{item.title}</span>
                        <span className="shrink-0 rounded-full bg-[#c6f15a] px-2 py-0.5 text-[12px] font-semibold">{formatPrice(item.price)}</span>
                      </div>
                    </Link>
                  ) : (
                    <div className="rounded-3xl bg-white/10 p-2.5">
                      <Skeleton className="aspect-[4/5] rounded-2xl opacity-20" />
                      <div className="h-8" />
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
          <Sparkles className="absolute top-0 right-24 size-7 text-accent/80" />
          <div className="absolute right-10 bottom-10 size-24 rounded-full bg-accent/20 blur-2xl" />
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */

function FiltersMenu({
  filters,
  onApply,
}: {
  filters: Filters
  onApply: (patch: Partial<Record<'min' | 'max' | 'condition', string | null>>) => void
}) {
  const [min, setMin] = useState(filters.min)
  const [max, setMax] = useState(filters.max)
  const [conditions, setConditions] = useState<string[]>(filters.conditions)
  const activeCount = (filters.min ? 1 : 0) + (filters.max ? 1 : 0) + filters.conditions.length

  useEffect(() => {
    setMin(filters.min)
    setMax(filters.max)
    setConditions(filters.conditions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.min, filters.max, filters.conditions.join(',')])

  return (
    <Dropdown
      align="right"
      className="w-[300px] p-4"
      trigger={({ toggle, open }) => (
        <Button variant="outline" onClick={toggle} className={cn('h-10', open && 'border-ink')} aria-expanded={open}>
          <SlidersHorizontal />
          Filters
          {activeCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-ink text-[11px] text-canvas">{activeCount}</span>
          )}
        </Button>
      )}
    >
      {(close) => (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onApply({ min: min || null, max: max || null, condition: conditions.length ? conditions.join(',') : null })
            close()
          }}
        >
          <p className="text-sm font-semibold">Price</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">$</span>
              <Input type="number" min={0} inputMode="decimal" placeholder="Min" value={min} onChange={(e) => setMin(e.target.value)} className="h-10 pl-7 text-sm" />
            </div>
            <span className="text-muted">–</span>
            <div className="relative flex-1">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">$</span>
              <Input type="number" min={0} inputMode="decimal" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value)} className="h-10 pl-7 text-sm" />
            </div>
          </div>
          <p className="mt-5 text-sm font-semibold">Condition</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CONDITIONS.map((c) => {
              const on = conditions.includes(c.value)
              return (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setConditions((prev) => (on ? prev.filter((x) => x !== c.value) : [...prev, c.value]))}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[13px] font-medium transition',
                    on ? 'border-ink bg-ink text-canvas' : 'border-line-strong text-ink-2 hover:border-ink/40',
                  )}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
          <div className="mt-6 flex gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => {
                onApply({ min: null, max: null, condition: null })
                close()
              }}
            >
              Reset
            </Button>
            <Button type="submit" className="flex-1">
              Apply
            </Button>
          </div>
        </form>
      )}
    </Dropdown>
  )
}

function ActiveFilters({
  filters,
  onUpdate,
  onClear,
}: {
  filters: Filters
  onUpdate: (patch: Partial<Record<'q' | 'category' | 'min' | 'max' | 'condition', string | null>>) => void
  onClear: () => void
}) {
  const chips: { label: string; onRemove: () => void }[] = []
  if (filters.q) chips.push({ label: `“${filters.q}”`, onRemove: () => onUpdate({ q: null }) })
  if (filters.category) chips.push({ label: getCategory(filters.category).name, onRemove: () => onUpdate({ category: null }) })
  if (filters.min || filters.max) {
    const label = filters.min && filters.max ? `$${filters.min} – $${filters.max}` : filters.min ? `From $${filters.min}` : `Up to $${filters.max}`
    chips.push({ label, onRemove: () => onUpdate({ min: null, max: null }) })
  }
  filters.conditions.forEach((c) =>
    chips.push({
      label: CONDITIONS.find((x) => x.value === c)?.label ?? c,
      onRemove: () => {
        const rest = filters.conditions.filter((x) => x !== c)
        onUpdate({ condition: rest.length ? rest.join(',') : null })
      },
    }),
  )
  if (!chips.length) return null

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span key={chip.label} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pr-1 pl-3 text-[13px] font-medium">
          {chip.label}
          <button onClick={chip.onRemove} className="rounded-full p-1 text-muted transition hover:bg-surface-3 hover:text-ink" aria-label={`Remove ${chip.label}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <button onClick={onClear} className="ml-1 text-[13px] font-medium text-muted underline-offset-4 hover:text-ink hover:underline">
        Clear all
      </button>
    </div>
  )
}

function ValueProps() {
  const items = [
    { icon: Camera, title: 'List in under a minute', body: 'Snap a few photos, set your price, and you’re live. We compress images so they load fast everywhere.' },
    { icon: MessageCircle, title: 'Chat before you buy', body: 'Ask questions, negotiate, and arrange details in real-time messaging — right next to the listing.' },
    { icon: ShieldCheck, title: 'Checkout that just works', body: 'Add items from several sellers to one cart and pay once. Track every order from purchase to doorstep.' },
  ]
  const { user } = useAuth()
  return (
    <section className="mt-24">
      <div className="grid gap-4 md:grid-cols-3">
        {items.map(({ icon: Icon, title, body }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
            className="rounded-3xl border border-line bg-surface p-7"
          >
            <div className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-ink">
              <Icon className="size-5" />
            </div>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
          </motion.div>
        ))}
      </div>

      <div className="relative mt-4 overflow-hidden rounded-3xl bg-accent px-7 py-10 text-accent-ink sm:px-12 sm:py-14">
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
              Got something gathering dust?
              <br />
              <span className="font-display font-normal italic">Someone’s looking for it.</span>
            </h3>
          </div>
          <ButtonLink to={user ? '/sell' : '/signup'} size="lg" className="self-start bg-[#111110] text-white hover:bg-[#111110]/85 md:self-auto">
            Start selling <ArrowRight />
          </ButtonLink>
        </div>
        <Sparkles className="absolute -right-6 -bottom-8 size-48 text-black/[0.06]" strokeWidth={1} />
      </div>
    </section>
  )
}
