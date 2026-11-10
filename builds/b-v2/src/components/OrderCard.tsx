import { Link } from 'react-router';
import { Check, ImageOff, MapPin, Package, Truck } from 'lucide-react';
import type { Order } from '../api/commerce';
import { formatDate, formatPrice } from '../lib/format';
import { imageUrl } from '../lib/images';
import { countryName } from '../lib/countries';
import { Avatar, Badge, cx } from './ui';
import type { ReactNode } from 'react';

const STEPS = [
  { key: 'paid', label: 'Paid', icon: Check },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: Package },
] as const;

export function StatusBadge({ status }: { status: Order['status'] }) {
  const tone = status === 'delivered' ? 'success' : status === 'shipped' ? 'brand' : status === 'cancelled' ? 'danger' : 'warning';
  const label = { paid: 'Awaiting shipment', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' }[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function OrderCard({ order, perspective, actions }: { order: Order; perspective: 'buyer' | 'seller'; actions?: ReactNode }) {
  const counterpart = perspective === 'buyer' ? order.seller : order.buyer;
  const stepIndex = STEPS.findIndex((s) => s.key === order.status);
  return (
    <article className="card overflow-hidden animate-rise">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-5 py-3.5 text-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span>
            <span className="text-muted">Order</span>{' '}
            <span className="font-mono font-semibold">#{order.id.slice(0, 8).toUpperCase()}</span>
          </span>
          <span className="text-muted">{formatDate(order.created_at)}</span>
          <span className="font-semibold">{formatPrice(order.subtotal_cents)}</span>
        </div>
        <StatusBadge status={order.status} />
      </header>

      <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          <ul className="space-y-3">
            {order.order_items.map((item) => {
              const img = imageUrl('listing-images', item.image_path);
              const content = (
                <>
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {img ? <img src={img} alt="" loading="lazy" className="size-full object-cover" /> : <ImageOff className="m-auto mt-5 size-5 text-muted" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-medium">{item.title}</p>
                    <p className="text-sm text-muted">{formatPrice(item.price_cents)}</p>
                  </div>
                </>
              );
              return (
                <li key={item.id}>
                  {item.listing_id ? (
                    <Link to={`/listing/${item.listing_id}`} className="flex items-center gap-3 rounded-xl hover:bg-surface-2/60">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>

          {order.status !== 'cancelled' && (
            <ol className="mt-6 flex items-center" aria-label="Order progress">
              {STEPS.map((s, i) => (
                <li key={s.key} className="flex flex-1 items-center last:flex-none">
                  <span
                    className={cx(
                      'flex size-8 items-center justify-center rounded-full',
                      i <= stepIndex ? 'bg-brand text-white' : 'bg-surface-2 text-muted',
                    )}
                    title={s.label}
                  >
                    <s.icon className="size-4" />
                  </span>
                  <span className={cx('ml-2 text-xs font-medium', i <= stepIndex ? 'text-ink' : 'text-muted')}>{s.label}</span>
                  {i < STEPS.length - 1 && <span className={cx('mx-3 h-0.5 flex-1 rounded', i < stepIndex ? 'bg-brand' : 'bg-line')} />}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              {perspective === 'buyer' ? 'Seller' : 'Buyer'}
            </p>
            {counterpart ? (
              <Link to={`/u/${counterpart.id}`} className="flex items-center gap-2 font-medium hover:text-brand-ink">
                <Avatar name={counterpart.display_name} path={counterpart.avatar_path} size={28} />
                {counterpart.display_name}
              </Link>
            ) : (
              <p className="text-muted">Deleted account</p>
            )}
          </div>
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
              <MapPin className="size-3" /> Ship to
            </p>
            <address className="not-italic leading-relaxed text-ink/90">
              {order.ship_name}
              <br />
              {order.ship_line1}
              {order.ship_line2 && (
                <>
                  <br />
                  {order.ship_line2}
                </>
              )}
              <br />
              {order.ship_city}
              {order.ship_region && `, ${order.ship_region}`} {order.ship_postal_code}
              <br />
              {countryName(order.ship_country)}
            </address>
          </div>
          {actions && <div className="flex flex-col gap-2 pt-1">{actions}</div>}
        </div>
      </div>
    </article>
  );
}
