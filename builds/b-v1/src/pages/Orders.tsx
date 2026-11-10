import { ChevronRight, MapPin, Package, PackageCheck, Receipt, Truck, Wallet } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { PageContainer } from '../components/layout/Layout'
import { ListingImage } from '../components/listings/ListingImage'
import { StatusPill } from '../components/orders/StatusPill'
import { Avatar } from '../components/ui/Avatar'
import { Button, ButtonLink } from '../components/ui/Button'
import { EmptyState, Skeleton } from '../components/ui/Feedback'
import { Tabs } from '../components/ui/Tabs'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { Order, OrderItem, SellerSummary } from '../lib/types'
import { displayName, errorMessage, formatDate, formatMoney, pluralize, timeAgo } from '../lib/utils'

type Purchase = Order & { items: Pick<OrderItem, 'id' | 'title' | 'price' | 'image' | 'status' | 'listing_id'>[] }
type Sale = OrderItem & {
  order: Pick<Order, 'order_number' | 'created_at' | 'shipping_name' | 'shipping_city' | 'shipping_country'> | null
  buyer: SellerSummary | null
}

export default function Orders() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'sales' ? 'sales' : 'purchases'

  return (
    <PageContainer className="max-w-5xl pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
          <p className="mt-1.5 text-muted">Everything you’ve bought and sold on Trove.</p>
        </div>
        <Tabs
          value={tab}
          onChange={(v) => setParams(v === 'sales' ? { tab: 'sales' } : {}, { replace: true })}
          tabs={[
            { value: 'purchases', label: 'Purchases' },
            { value: 'sales', label: 'Sales' },
          ]}
        />
      </div>
      <div className="mt-8">{tab === 'purchases' ? <Purchases /> : <Sales />}</div>
    </PageContainer>
  )
}

function Purchases() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Purchase[] | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('orders')
      .select('*, items:order_items(id, title, price, image, status, listing_id)')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setOrders((data ?? []) as unknown as Purchase[]))
  }, [user])

  if (!orders) return <ListSkeleton />
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No purchases yet"
        description="When you buy something, your order and its delivery status will show up here."
        action={<ButtonLink to="/">Find something you love</ButtonLink>}
      />
    )
  }

  return (
    <div className="space-y-4">
      {orders.map((o) => {
        const statuses = o.items.map((i) => i.status)
        const overall = statuses.every((s) => s === 'delivered') ? 'delivered' : statuses.some((s) => s !== 'processing') ? 'shipped' : 'processing'
        return (
          <Link
            key={o.id}
            to={`/orders/${o.id}`}
            className="group block rounded-3xl border border-line bg-surface p-5 transition hover:border-line-strong hover:shadow-soft sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-medium">{o.order_number}</span>
                <StatusPill status={overall} />
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted">{formatDate(o.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span className="font-semibold tabular-nums">{formatMoney(o.total)}</span>
                <ChevronRight className="size-4 text-muted transition group-hover:translate-x-0.5" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex -space-x-3">
                {o.items.slice(0, 4).map((i) => (
                  <ListingImage key={i.id} path={i.image} alt="" width={160} className="size-16 rounded-2xl ring-4 ring-surface" />
                ))}
              </div>
              <div className="min-w-0 pl-2">
                <p className="truncate text-sm font-medium">
                  {o.items[0]?.title}
                  {o.items.length > 1 && <span className="text-muted"> + {pluralize(o.items.length - 1, 'more item')}</span>}
                </p>
                <p className="mt-0.5 text-[13px] text-muted">
                  Shipping to {o.shipping_city}, {o.shipping_country}
                </p>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function Sales() {
  const { user } = useAuth()
  const [sales, setSales] = useState<Sale[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('order_items')
      .select(
        '*, order:orders(order_number, created_at, shipping_name, shipping_city, shipping_country), buyer:profiles!order_items_buyer_id_fkey(id, username, full_name, avatar_url)',
      )
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })
    setSales((data ?? []) as unknown as Sale[])
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const markShipped = async (id: string) => {
    setBusy(id)
    const { error } = await supabase.rpc('update_order_item_status', { p_item_id: id, p_status: 'shipped' })
    setBusy(null)
    if (error) return toast.error(errorMessage(error))
    toast.success('Marked as shipped — the buyer can now track it')
    setSales((prev) => prev?.map((s) => (s.id === id ? { ...s, status: 'shipped' } : s)) ?? null)
  }

  if (!sales) return <ListSkeleton />

  const earnings = sales.reduce((sum, s) => sum + Number(s.price), 0)
  const toShip = sales.filter((s) => s.status === 'processing').length

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Wallet, label: 'Total earnings', value: formatMoney(earnings) },
          { icon: PackageCheck, label: 'Items sold', value: sales.length.toLocaleString() },
          { icon: Truck, label: 'Awaiting shipment', value: toShip.toLocaleString(), highlight: toShip > 0 },
        ].map(({ icon: Icon, label, value, highlight }) => (
          <div key={label} className={`rounded-3xl border p-5 ${highlight ? 'border-transparent bg-accent text-accent-ink' : 'border-line bg-surface'}`}>
            <Icon className={`size-5 ${highlight ? '' : 'text-muted'}`} />
            <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
            <p className={`text-[13px] ${highlight ? 'text-accent-ink/70' : 'text-muted'}`}>{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        {sales.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No sales yet"
            description="When someone buys one of your listings, it’ll appear here so you can ship it."
            action={<ButtonLink to="/sell" variant="accent">List an item</ButtonLink>}
          />
        ) : (
          <div className="overflow-hidden rounded-3xl border border-line bg-surface">
            <ul className="divide-y divide-line">
              {sales.map((s) => (
                <li key={s.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <ListingImage path={s.image} alt="" width={160} className="size-16 shrink-0 rounded-2xl" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                        <span className="font-mono">{s.order?.order_number}</span>·<span>{timeAgo(s.created_at)}</span>
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 text-[13px] text-ink-2">
                        <Avatar src={s.buyer?.avatar_url} name={displayName(s.buyer)} seed={s.buyer?.id} size={20} />
                        <span className="truncate">{s.order?.shipping_name ?? displayName(s.buyer)}</span>
                        <span className="flex items-center gap-1 text-muted">
                          <MapPin className="size-3" />
                          {s.order?.shipping_city}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <p className="font-semibold tabular-nums">{formatMoney(s.price)}</p>
                    <StatusPill status={s.status} />
                    {s.status === 'processing' && (
                      <Button size="sm" onClick={() => markShipped(s.id)} loading={busy === s.id}>
                        <Truck /> Mark shipped
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-36 rounded-3xl" />
      ))}
    </div>
  )
}
