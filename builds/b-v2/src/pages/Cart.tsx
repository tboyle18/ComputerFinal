import { Link, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, ImageOff, Lock, ShoppingBag, Trash2 } from 'lucide-react';
import { isAvailable, removeFromCart, type CartRow } from '../api/commerce';
import { useAuth } from '../auth/AuthProvider';
import { keys, useCart } from '../hooks/queries';
import { formatPrice } from '../lib/format';
import { imageUrl } from '../lib/images';
import { friendlyError } from '../lib/errors';
import { useToast } from '../components/Toast';
import { Alert, Avatar, Button, ButtonLink, EmptyState, PageLoader, SectionTitle, cx } from '../components/ui';

export function Cart() {
  const { data: cart, isPending, isError, error } = useCart();
  const navigate = useNavigate();

  if (isPending) return <PageLoader />;
  if (isError) return <div className="mx-auto max-w-3xl px-4 py-16"><Alert tone="danger">{friendlyError(error)}</Alert></div>;

  const available = cart.filter(isAvailable);
  const unavailable = cart.filter((r) => !isAvailable(r));
  const total = available.reduce((sum, r) => sum + (r.listing?.price_cents ?? 0), 0);
  const sellers = new Set(available.map((r) => r.listing?.seller_id)).size;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <SectionTitle title="Your bag" subtitle={cart.length ? `${cart.length} item${cart.length === 1 ? '' : 's'}` : undefined} />
      {cart.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="size-7" />} title="Your bag is empty" action={<ButtonLink to="/">Start browsing</ButtonLink>}>
          When you find something you love, add it here to check out.
        </EmptyState>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            {unavailable.length > 0 && (
              <Alert tone="warning" icon={<AlertTriangle className="size-4" />}>
                {unavailable.length === 1 ? 'One item is' : `${unavailable.length} items are`} no longer available. Remove{' '}
                {unavailable.length === 1 ? 'it' : 'them'} to continue.
              </Alert>
            )}
            {cart.map((row) => (
              <CartLine key={row.listing_id} row={row} />
            ))}
          </div>

          <aside className="card h-fit p-6 lg:sticky lg:top-24">
            <h2 className="text-lg font-semibold">Order summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Items ({available.length})</dt>
                <dd className="font-medium">{formatPrice(total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd className="font-medium text-success">Free</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-base">
                <dt className="font-semibold">Total</dt>
                <dd className="font-display text-xl font-extrabold">{formatPrice(total)}</dd>
              </div>
            </dl>
            {sellers > 1 && <p className="mt-3 text-xs text-muted">Items from {sellers} sellers will ship as separate orders.</p>}
            <Button
              size="lg"
              className="mt-6 w-full"
              disabled={available.length === 0 || unavailable.length > 0}
              onClick={() => navigate('/checkout')}
            >
              Checkout <ArrowRight className="size-4" />
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
              <Lock className="size-3.5" /> Prices are re-checked securely at checkout
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}

function CartLine({ row }: { row: CartRow }) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => removeFromCart(user!.id, row.listing_id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.cart(user!.id) }),
    onError: (e) => toast.error(friendlyError(e)),
  });
  const l = row.listing;
  const ok = isAvailable(row);
  const img = imageUrl('listing-images', l?.image_paths[0]);

  return (
    <div className={cx('card flex gap-4 p-4', !ok && 'opacity-70')}>
      <Link to={l ? `/listing/${l.id}` : '#'} className="size-24 shrink-0 overflow-hidden rounded-xl bg-surface-2">
        {img ? <img src={img} alt="" className="size-full object-cover" /> : <ImageOff className="m-auto mt-8 size-6 text-muted" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {l ? (
              <Link to={`/listing/${l.id}`} className="line-clamp-2 font-semibold hover:text-brand-ink">
                {l.title}
              </Link>
            ) : (
              <p className="font-semibold text-muted">Listing no longer available</p>
            )}
            {l?.seller && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                <Avatar name={l.seller.display_name} path={l.seller.avatar_path} size={20} className="!size-5 !text-[9px]" />
                {l.seller.display_name}
              </p>
            )}
          </div>
          {l && <p className="font-display text-lg font-bold">{formatPrice(l.price_cents)}</p>}
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          {!ok ? (
            <span className="text-sm font-medium text-danger">{l?.status === 'sold' ? 'Sold' : 'Unavailable'}</span>
          ) : (
            <span className="text-sm text-success">Available</span>
          )}
          <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" />} loading={remove.isPending} onClick={() => remove.mutate()}>
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}
