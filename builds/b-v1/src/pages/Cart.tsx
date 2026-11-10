import { ArrowRight, Lock, ShoppingBag, Store, Trash2, TriangleAlert, Truck } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { PageContainer } from '../components/layout/Layout'
import { ListingImage } from '../components/listings/ListingImage'
import { Avatar } from '../components/ui/Avatar'
import { ButtonLink } from '../components/ui/Button'
import { EmptyState, Skeleton } from '../components/ui/Feedback'
import { useCart, type CartItem } from '../context/CartContext'
import { cn, conditionLabel, displayName, formatMoney, pluralize, SHIPPING_PER_SELLER } from '../lib/utils'

export function useCartTotals(items: CartItem[]) {
  return useMemo(() => {
    const available = items.filter((i) => i.listing && i.listing.status === 'active')
    const unavailable = items.filter((i) => !i.listing || i.listing.status !== 'active')
    const subtotal = available.reduce((sum, i) => sum + Number(i.listing!.price), 0)
    const sellers = new Set(available.map((i) => i.listing!.seller_id)).size
    const shipping = sellers * SHIPPING_PER_SELLER
    return { available, unavailable, subtotal, sellers, shipping, total: subtotal + shipping }
  }, [items])
}

export default function Cart() {
  const { items, loading, remove } = useCart()
  const totals = useCartTotals(items)

  const groups = useMemo(() => {
    const map = new Map<string, CartItem[]>()
    for (const item of items) {
      const key = item.listing?.seller_id ?? 'unknown'
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return [...map.values()]
  }, [items])

  if (loading && items.length === 0) {
    return (
      <PageContainer className="pt-8">
        <Skeleton className="h-9 w-48" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      </PageContainer>
    )
  }

  if (items.length === 0) {
    return (
      <PageContainer className="max-w-2xl py-16">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="When you find something you love, add it to your cart and check out with everything at once."
          action={<ButtonLink to="/">Discover listings</ButtonLink>}
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer className="pt-8">
      <h1 className="text-3xl font-semibold tracking-tight">Your cart</h1>
      <p className="mt-1.5 text-muted">
        {pluralize(items.length, 'item')} from {pluralize(groups.length, 'seller')}
      </p>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {groups.map((group) => {
            const seller = group[0].listing?.seller
            return (
              <section key={group[0].listing?.seller_id ?? 'x'} className="overflow-hidden rounded-3xl border border-line bg-surface">
                <header className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/40 px-5 py-3">
                  <Link to={seller ? `/u/${seller.username}` : '#'} className="flex items-center gap-2.5 text-sm font-medium hover:underline">
                    <Avatar src={seller?.avatar_url} name={displayName(seller)} seed={seller?.id} size={26} />
                    {displayName(seller)}
                  </Link>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <Truck className="size-3.5" /> Ships separately · {formatMoney(SHIPPING_PER_SELLER)}
                  </span>
                </header>
                <ul className="divide-y divide-line">
                  <AnimatePresence initial={false}>
                    {group.map((item) => {
                      const l = item.listing
                      const unavailable = !l || l.status !== 'active'
                      return (
                        <motion.li
                          key={item.listing_id}
                          layout
                          exit={{ opacity: 0, height: 0 }}
                          className="flex gap-4 p-4 sm:p-5"
                        >
                          <Link to={`/listing/${item.listing_id}`} className="shrink-0">
                            <ListingImage
                              path={l?.images[0]}
                              alt={l?.title ?? ''}
                              category={l?.category}
                              width={240}
                              className={cn('size-24 rounded-2xl sm:size-28', unavailable && 'opacity-50 grayscale')}
                            />
                          </Link>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <Link to={`/listing/${item.listing_id}`} className="line-clamp-2 font-medium hover:underline">
                                  {l?.title ?? 'Listing removed'}
                                </Link>
                                {l && <p className="mt-1 text-[13px] text-muted">{conditionLabel(l.condition)} · {l.location || 'Ships from seller'}</p>}
                              </div>
                              <p className={cn('shrink-0 font-semibold tabular-nums', unavailable && 'text-muted line-through')}>
                                {formatMoney(l?.price)}
                              </p>
                            </div>
                            <div className="mt-auto flex items-center justify-between pt-3">
                              {unavailable ? (
                                <span className="flex items-center gap-1.5 text-[13px] font-medium text-danger">
                                  <TriangleAlert className="size-3.5" /> No longer available
                                </span>
                              ) : (
                                <span className="text-[13px] text-success">In stock · 1 available</span>
                              )}
                              <button
                                onClick={() => remove(item.listing_id)}
                                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium text-muted transition hover:bg-surface-2 hover:text-danger"
                              >
                                <Trash2 className="size-3.5" /> Remove
                              </button>
                            </div>
                          </div>
                        </motion.li>
                      )
                    })}
                  </AnimatePresence>
                </ul>
              </section>
            )
          })}
        </div>

        <OrderSummary totals={totals}>
          {totals.unavailable.length > 0 && (
            <p className="mb-3 flex gap-2 rounded-2xl bg-danger/10 p-3 text-[13px] text-danger">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              Remove items that are no longer available to continue.
            </p>
          )}
          <ButtonLink
            to="/checkout"
            size="lg"
            variant="accent"
            className={cn('w-full', (totals.unavailable.length > 0 || totals.available.length === 0) && 'pointer-events-none opacity-50')}
            aria-disabled={totals.unavailable.length > 0}
          >
            Checkout <ArrowRight />
          </ButtonLink>
          <ButtonLink to="/" variant="ghost" className="mt-2 w-full">
            Continue shopping
          </ButtonLink>
        </OrderSummary>
      </div>
    </PageContainer>
  )
}

export function OrderSummary({
  totals,
  children,
  items,
}: {
  totals: ReturnType<typeof useCartTotals>
  children?: React.ReactNode
  items?: CartItem[]
}) {
  return (
    <aside className="rounded-3xl border border-line bg-surface p-6 lg:sticky lg:top-24">
      <h2 className="font-semibold">Order summary</h2>
      {items && (
        <ul className="mt-5 space-y-3">
          {items.map((i) => (
            <li key={i.listing_id} className="flex items-center gap-3">
              <div className="relative">
                <ListingImage path={i.listing?.images[0]} alt="" category={i.listing?.category} width={120} className="size-14 rounded-xl" />
              </div>
              <p className="line-clamp-2 flex-1 text-sm">{i.listing?.title}</p>
              <p className="text-sm font-medium tabular-nums">{formatMoney(i.listing?.price)}</p>
            </li>
          ))}
        </ul>
      )}
      <dl className={cn('space-y-2.5 text-sm', items ? 'mt-5 border-t border-line pt-5' : 'mt-5')}>
        <div className="flex justify-between">
          <dt className="text-muted">Subtotal · {pluralize(totals.available.length, 'item')}</dt>
          <dd className="tabular-nums">{formatMoney(totals.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="flex items-center gap-1.5 text-muted">
            <Store className="size-3.5" /> Shipping · {pluralize(totals.sellers, 'seller')}
          </dt>
          <dd className="tabular-nums">{formatMoney(totals.shipping)}</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-3.5">
          <dt className="font-semibold">Total</dt>
          <dd className="text-2xl font-semibold tracking-tight tabular-nums">{formatMoney(totals.total)}</dd>
        </div>
      </dl>
      <div className="mt-5">{children}</div>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted">
        <Lock className="size-3" /> Simulated checkout — no real payment is taken
      </p>
    </aside>
  )
}
