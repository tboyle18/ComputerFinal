import { ArrowLeft, Check, CreditCard, MapPin, MessageCircle, PackageCheck, Receipt, Truck } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { PageContainer } from '../components/layout/Layout'
import { ListingImage } from '../components/listings/ListingImage'
import { StatusTrack } from '../components/orders/StatusPill'
import { Avatar } from '../components/ui/Avatar'
import { Button, ButtonLink } from '../components/ui/Button'
import { EmptyState, PageLoader } from '../components/ui/Feedback'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { Order, OrderItem, SellerSummary } from '../lib/types'
import { displayName, errorMessage, formatDate, formatMoney } from '../lib/utils'

type Item = OrderItem & { seller: SellerSummary | null }
type FullOrder = Order & { items: Item[] }

export default function OrderDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const justPlaced = params.get('placed') === '1'
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [order, setOrder] = useState<FullOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('orders')
      .select('*, items:order_items(*, seller:profiles!order_items_seller_id_fkey(id, username, full_name, avatar_url))')
      .eq('id', id ?? '')
      .maybeSingle()
      .then(({ data }) => {
        setOrder(data as unknown as FullOrder | null)
        setLoading(false)
      })
  }, [id])

  if (loading) return <PageLoader />
  if (!order) {
    return (
      <PageContainer className="py-16">
        <EmptyState icon={Receipt} title="Order not found" action={<ButtonLink to="/orders">Your orders</ButtonLink>} />
      </PageContainer>
    )
  }

  const isBuyer = order.buyer_id === user?.id

  const updateStatus = async (item: Item, status: 'shipped' | 'delivered') => {
    setBusy(item.id)
    const { error } = await supabase.rpc('update_order_item_status', { p_item_id: item.id, p_status: status })
    setBusy(null)
    if (error) return toast.error(errorMessage(error))
    setOrder({ ...order, items: order.items.map((i) => (i.id === item.id ? { ...i, status } : i)) })
    toast.success(status === 'delivered' ? 'Enjoy your new find!' : 'Marked as shipped')
  }

  const messageSeller = async (item: Item) => {
    if (!item.listing_id) return toast.error('This listing has been removed')
    setBusy(`msg-${item.id}`)
    const { data, error } = await supabase.rpc('start_conversation', { p_listing_id: item.listing_id })
    setBusy(null)
    if (error || !data) return toast.error(errorMessage(error))
    navigate(`/messages/${data}`)
  }

  return (
    <PageContainer className="max-w-5xl pt-8">
      {justPlaced ? (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="hero-glow relative overflow-hidden rounded-[28px] px-6 py-10 text-center text-white sm:px-10 sm:py-14"
        >
          <div className="dotted-bg absolute inset-0" />
          <div className="relative">
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
              className="mx-auto flex size-16 items-center justify-center rounded-full bg-accent text-accent-ink shadow-pop"
            >
              <Check className="size-8" strokeWidth={3} />
            </motion.div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
              Thank you{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}!
            </h1>
            <p className="mt-2 text-white/65">
              Order <span className="font-mono text-white">{order.order_number}</span> is confirmed. The {order.items.length > 1 ? 'sellers have' : 'seller has'} been
              notified and will ship soon.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <ButtonLink to="/" variant="accent">
                Keep shopping
              </ButtonLink>
              <ButtonLink to="/orders" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                All orders
              </ButtonLink>
            </div>
          </div>
        </motion.section>
      ) : (
        <>
          <Link to={isBuyer ? '/orders' : '/orders?tab=sales'} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft className="size-4" /> Back to orders
          </Link>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Order <span className="font-mono text-2xl">{order.order_number}</span>
              </h1>
              <p className="mt-1 text-muted">Placed {formatDate(order.created_at, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>
        </>
      )}

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-3xl border border-line bg-surface">
          <h2 className="border-b border-line px-6 py-4 font-semibold">Items</h2>
          <ul className="divide-y divide-line">
            {order.items.map((item) => {
              const isSeller = item.seller_id === user?.id
              return (
                <li key={item.id} className="p-5 sm:p-6">
                  <div className="flex gap-4">
                    <Link to={item.listing_id ? `/listing/${item.listing_id}` : '#'} className="shrink-0">
                      <ListingImage path={item.image} alt={item.title} width={240} className="size-20 rounded-2xl sm:size-24" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium">{item.title}</p>
                        <p className="shrink-0 font-semibold tabular-nums">{formatMoney(item.price)}</p>
                      </div>
                      {item.seller && (
                        <Link to={`/u/${item.seller.username}`} className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
                          <Avatar src={item.seller.avatar_url} name={displayName(item.seller)} seed={item.seller.id} size={18} />
                          Sold by {displayName(item.seller)}
                        </Link>
                      )}
                      <div className="mt-4 max-w-sm">
                        <StatusTrack status={item.status} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {isBuyer && item.listing_id && (
                      <Button size="sm" variant="ghost" onClick={() => messageSeller(item)} loading={busy === `msg-${item.id}`}>
                        <MessageCircle /> Message seller
                      </Button>
                    )}
                    {isBuyer && item.status === 'shipped' && (
                      <Button size="sm" onClick={() => updateStatus(item, 'delivered')} loading={busy === item.id}>
                        <PackageCheck /> Confirm delivery
                      </Button>
                    )}
                    {isSeller && item.status === 'processing' && (
                      <Button size="sm" onClick={() => updateStatus(item, 'shipped')} loading={busy === item.id}>
                        <Truck /> Mark shipped
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-line bg-surface p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="size-4 text-muted" /> Shipping to
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              {order.shipping_name}
              <br />
              {order.shipping_address}
              <br />
              {order.shipping_city} {order.shipping_postcode}
              <br />
              {order.shipping_country}
            </p>
          </div>
          {isBuyer && (
            <div className="rounded-3xl border border-line bg-surface p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <CreditCard className="size-4 text-muted" /> Payment
              </h3>
              <p className="mt-3 text-sm text-ink-2">
                {order.payment_brand} ending in <span className="font-mono">{order.payment_last4}</span>
              </p>
              <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Subtotal</dt>
                  <dd className="tabular-nums">{formatMoney(order.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Shipping</dt>
                  <dd className="tabular-nums">{formatMoney(order.shipping_fee)}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-3 font-semibold">
                  <dt>Total paid</dt>
                  <dd className="tabular-nums">{formatMoney(order.total)}</dd>
                </div>
              </dl>
            </div>
          )}
        </aside>
      </div>
    </PageContainer>
  )
}
