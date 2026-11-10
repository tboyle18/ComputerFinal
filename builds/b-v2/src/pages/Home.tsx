import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowRight, LayoutGrid, Lock, PackageSearch, Search, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { searchListings, PAGE_SIZE, type Condition, type ListingFilters, type Sort } from '../api/listings';
import { categoryIcon, useCategories } from '../lib/categories';
import { CONDITION_LABELS, parsePriceToCents } from '../lib/format';
import { friendlyError } from '../lib/errors';
import { ListingCard, ListingGridSkeleton } from '../components/ListingCard';
import { Alert, Button, ButtonLink, EmptyState, Input, Select, cx } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';

const SORTS: Record<Sort, string> = {
  newest: 'Newest first',
  relevance: 'Best match',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
};

/** URL params are user input: parse defensively and drop anything invalid. */
function parseFilters(params: URLSearchParams, validCategories: Set<string> | null): ListingFilters {
  const q = (params.get('q') ?? '').trim().slice(0, 100);
  const category = params.get('category') ?? '';
  const sort = params.get('sort') as Sort | null;
  const condition = params.get('condition') as Condition | null;
  const min = parsePriceToCents(params.get('min') ?? '');
  const max = parsePriceToCents(params.get('max') ?? '');
  return {
    q: q || undefined,
    category: category && (!validCategories || validCategories.has(category)) ? category : undefined,
    sort: sort && sort in SORTS ? sort : q ? 'relevance' : 'newest',
    condition: condition && condition in CONDITION_LABELS ? condition : undefined,
    minPrice: min ?? undefined,
    maxPrice: max ?? undefined,
  };
}

export function Home() {
  const [params, setParams] = useSearchParams();
  const { data: categories } = useCategories();
  const validCategories = useMemo(() => (categories ? new Set(categories.map((c) => c.slug)) : null), [categories]);
  const filters = useMemo(() => parseFilters(params, validCategories), [params, validCategories]);
  const [showFilters, setShowFilters] = useState(false);
  const hasQuery = !!(filters.q || filters.category || filters.condition || filters.minPrice || filters.maxPrice);

  const query = useInfiniteQuery({
    queryKey: ['listings', filters],
    queryFn: ({ pageParam }) => searchListings(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === PAGE_SIZE && all.length < 40 ? all.length : undefined),
  });
  const listings = query.data?.pages.flat() ?? [];

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: false });
  };

  const activeCategory = categories?.find((c) => c.slug === filters.category);

  return (
    <>
      <Hero compact={hasQuery} initialQuery={filters.q ?? ''} onSearch={(q) => update({ q: q || undefined, sort: undefined })} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Category rail */}
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <CategoryChip active={!filters.category} onClick={() => update({ category: undefined })} icon={LayoutGrid} label="All" />
          {categories?.map((c) => (
            <CategoryChip
              key={c.slug}
              active={filters.category === c.slug}
              onClick={() => update({ category: filters.category === c.slug ? undefined : c.slug })}
              icon={categoryIcon(c.slug)}
              label={c.name}
            />
          ))}
        </div>

        {/* Toolbar */}
        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">
              {filters.q ? (
                <>
                  Results for <span className="text-brand">“{filters.q}”</span>
                </>
              ) : activeCategory ? (
                activeCategory.name
              ) : (
                'Fresh finds'
              )}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {hasQuery ? 'Filtered results' : 'The newest listings from sellers near you'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showFilters ? 'soft' : 'outline'}
              size="sm"
              icon={<SlidersHorizontal className="size-4" />}
              onClick={() => setShowFilters((s) => !s)}
              aria-expanded={showFilters}
            >
              Filters
            </Button>
            <Select
              aria-label="Sort by"
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value })}
              className="h-9 w-auto rounded-xl py-0 text-sm"
            >
              {Object.entries(SORTS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {showFilters && <FiltersPanel params={params} onApply={update} />}

        {hasQuery && (
          <div className="mt-4 flex flex-wrap gap-2">
            {filters.condition && <FilterPill label={CONDITION_LABELS[filters.condition]} onClear={() => update({ condition: undefined })} />}
            {filters.minPrice !== undefined && <FilterPill label={`Min $${params.get('min')}`} onClear={() => update({ min: undefined })} />}
            {filters.maxPrice !== undefined && <FilterPill label={`Max $${params.get('max')}`} onClear={() => update({ max: undefined })} />}
            <button onClick={() => setParams(new URLSearchParams())} className="text-sm font-medium text-brand-ink hover:underline">
              Clear all
            </button>
          </div>
        )}

        {/* Results */}
        <div className="mt-8">
          {query.isPending ? (
            <ListingGridSkeleton />
          ) : query.isError ? (
            <Alert tone="danger">{friendlyError(query.error, 'We couldn’t load listings. Please refresh.')}</Alert>
          ) : listings.length === 0 ? (
            <EmptyState
              icon={<PackageSearch className="size-7" />}
              title="Nothing here yet"
              action={
                hasQuery ? (
                  <Button variant="outline" onClick={() => setParams(new URLSearchParams())}>
                    Clear filters
                  </Button>
                ) : (
                  <ButtonLink to="/sell">List the first item</ButtonLink>
                )
              }
            >
              {hasQuery ? 'Try a different search or remove some filters.' : 'Be the first to list something.'}
            </EmptyState>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                {listings.map((l, i) => (
                  <ListingCard key={l.id} listing={l} index={i % PAGE_SIZE} />
                ))}
              </div>
              {query.hasNextPage && (
                <div className="mt-12 flex justify-center">
                  <Button variant="outline" size="lg" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {!hasQuery && <SellBanner />}
      </div>
    </>
  );
}

function Hero({ compact, initialQuery, onSearch }: { compact: boolean; initialQuery: string; onSearch: (q: string) => void }) {
  const [q, setQ] = useState(initialQuery);
  useEffect(() => setQ(initialQuery), [initialQuery]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(q.trim().slice(0, 100));
  };

  return (
    <section className={cx('hero-glow relative overflow-hidden', compact ? 'pb-8 pt-8' : 'pb-14 pt-14 sm:pb-20 sm:pt-20')}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {!compact && (
          <div className="max-w-3xl animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-semibold text-brand-ink backdrop-blur">
              <Sparkles className="size-3.5" /> New finds every day
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] sm:text-6xl">
              Find something
              <br />
              <span className="bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">worth keeping.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Buy and sell pre-loved and new things with people nearby. Safe messaging, private checkout, zero clutter.
            </p>
          </div>
        )}
        <form onSubmit={submit} role="search" className={cx('relative max-w-2xl', !compact && 'mt-8 animate-rise')}>
          <Search className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={100}
            placeholder="Search cameras, sneakers, vinyl…"
            aria-label="Search listings"
            className="h-14 w-full rounded-2xl border border-line bg-surface pl-13 pr-32 text-base shadow-lift placeholder:text-muted/80 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
          />
          <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2" icon={<Search className="size-4" />}>
            Search
          </Button>
        </form>
        {!compact && (
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted animate-fade-in">
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-success" /> Verified email accounts
            </li>
            <li className="flex items-center gap-2">
              <Lock className="size-4 text-success" /> Your address stays private
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="size-4 text-success" /> Moderated listings
            </li>
          </ul>
        )}
      </div>
    </section>
  );
}

function CategoryChip({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all',
        active ? 'border-transparent bg-ink text-bg shadow-soft' : 'border-line bg-surface text-ink hover:border-ink/30',
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function FilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft py-1 pl-3 pr-1.5 text-sm font-medium text-brand-ink">
      {label}
      <button onClick={onClear} className="rounded-full p-0.5 hover:bg-brand/15" aria-label={`Remove ${label}`}>
        <X className="size-3.5" />
      </button>
    </span>
  );
}

function FiltersPanel({ params, onApply }: { params: URLSearchParams; onApply: (p: Record<string, string | undefined>) => void }) {
  const [min, setMin] = useState(params.get('min') ?? '');
  const [max, setMax] = useState(params.get('max') ?? '');
  const [condition, setCondition] = useState(params.get('condition') ?? '');
  const [error, setError] = useState<string | null>(null);

  const apply = (e: FormEvent) => {
    e.preventDefault();
    const minC = min ? parsePriceToCents(min) : null;
    const maxC = max ? parsePriceToCents(max) : null;
    if ((min && minC === null) || (max && maxC === null)) return setError('Enter prices like 20 or 19.99.');
    if (minC !== null && maxC !== null && minC > maxC) return setError('Minimum must be below maximum.');
    setError(null);
    onApply({ min: min || undefined, max: max || undefined, condition: condition || undefined });
  };

  return (
    <form onSubmit={apply} className="card mt-4 grid gap-4 p-5 animate-pop sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Min price ($)
        <Input inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" maxLength={10} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Max price ($)
        <Input inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Any" maxLength={10} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Condition
        <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
          <option value="">Any condition</option>
          {Object.entries(CONDITION_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </label>
      <Button type="submit">Apply</Button>
      {error && <p className="text-sm text-danger sm:col-span-4">{error}</p>}
    </form>
  );
}

function SellBanner() {
  const { user } = useAuth();
  return (
    <section className="relative mt-20 overflow-hidden rounded-[2rem] bg-ink px-6 py-12 text-bg sm:px-12">
      <div className="hero-glow absolute inset-0 opacity-60" aria-hidden />
      <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div>
          <h2 className="text-3xl font-extrabold">Got something to sell?</h2>
          <p className="mt-2 max-w-md opacity-75">List it in under a minute. Photos are cleaned of location data automatically.</p>
        </div>
        <Link
          to={user ? '/sell' : '/signup'}
          className="inline-flex h-12 items-center gap-2 rounded-2xl bg-bg px-6 font-semibold text-ink transition hover:opacity-90"
        >
          Start selling <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
