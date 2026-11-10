import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MessageCircle, Package, Receipt, Truck } from 'lucide-react';
import { confirmDelivered, getCheckout, getOrders, markShipped, type Order } from '../api/commerce';
import { useAuth } from '../auth/AuthProvider';
import { keys } from '../hooks/queries';
import { formatDateTime, formatPrice, isUuid } from '../lib/format';
import { friendlyError } from '../lib/errors';
import { useToast } from '../components/Toast';
import { OrderCard } from '../components/OrderCard';
import { Alert, Button, ButtonLink, EmptyState, PageLoader, SectionTitle } from '../components/ui';
import { NotFound } from './NotFound';

/* ------------------------------------------------------------- Buyer --- */
export function Orders() {
  const { user } = useAuth();
  const { data, isPending, isError, error } = useQuery({
    queryKey: keys.orders(user!.id, 'buyer'),
    queryFn: () => getOrders(user!.id, 'buyer'),
  });
  if (isPending) return <PageLoader />;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <SectionTitle title="Your orders" subtitle="Track purchases and confirm when they arrive." />
      {isError ? (
        <Alert tone="danger">{friendlyError(error)}</Alert>
      ) : data.length === 0 ? (
        <EmptyState icon={<Package className="size-7" />} title="No orders yet" action={<ButtonLink to="/">Find something</ButtonLink>}>
          Items you buy will show up here.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {data.map((o) => (
            <OrderCard key={o.id} order={o} perspective="buyer" actions={<BuyerActions order={o} />} />
          ))}
        </div>
      )}
    </div>
  );
}

function BuyerActions({ order }: { order: Order }) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: () => confirmDelivered(order.id),
    onSuccess: () => {
      toast.success('Thanks for confirming!');
      void queryClient.invalidateQueries({ queryKey: keys.orders(user!.id, 'buyer') });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
  return (
    <>
      {order.status === 'shipped' && (
        <Button size="sm" icon={<CheckCircle2 className="size-4" />} loading={m.isPending} onClick={() => m.mutate()}>
          I received it
        </Button>
      )}
      {order.order_items[0]?.listing_id && (
        <ButtonLink to={`/listing/${order.order_items[0].listing_id}`} size="sm" variant="outline" icon={<MessageCircle className="size-4" />}>
          View item
        </ButtonLink>
      )}
    </>
  );
}

/* ------------------------------------------------------------ Seller --- */
export function Sales() {
  const { user } = useAuth();
  const { data, isPending, isError, error } = useQuery({
    queryKey: keys.orders(user!.id, 'seller'),
    queryFn: () => getOrders(user!.id, 'seller'),
  });
  if (isPending) return <PageLoader />;
  const pending = data?.filter((o) => o.status === 'paid').length ?? 0;
  const revenue = data?.reduce((s, o) => s + o.subtotal_cents, 0) ?? 0;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <SectionTitle title="Sales" subtitle="Ship sold items and keep buyers in the loop." />
      {isError ? (
        <Alert tone="danger">{friendlyError(error)}</Alert>
      ) : data.length === 0 ? (
        <EmptyState icon={<Receipt className="size-7" />} title="No sales yet" action={<ButtonLink to="/sell">List an item</ButtonLink>}>
          When someone buys one of your items, it’ll appear here with the shipping address.
        </EmptyState>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Stat label="Orders" value={String(data.length)} />
            <Stat label="To ship" value={String(pending)} highlight={pending > 0} />
            <Stat label="Revenue (simulated)" value={formatPrice(revenue)} />
          </div>
          <Alert tone="neutral">Buyer addresses are confidential. Use them only to ship the order.</Alert>
          <div className="mt-5 space-y-5">
            {data.map((o) => (
              <OrderCard key={o.id} order={o} perspective="seller" actions={<SellerActions order={o} />} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-extrabold ${highlight ? 'text-accent' : ''}`}>{value}</p>
    </div>
  );
}

function SellerActions({ order }: { order: Order }) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: () => markShipped(order.id),
    onSuccess: () => {
      toast.success('Marked as shipped. The buyer can now see it’s on the way.');
      void queryClient.invalidateQueries({ queryKey: keys.orders(user!.id, 'seller') });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
  if (order.status !== 'paid') return null;
  return (
    <Button size="sm" icon={<Truck className="size-4" />} loading={m.isPending} onClick={() => m.mutate()}>
      Mark as shipped
    </Button>
  );
}

/* ---------------------------------------------------- Confirmation --- */
export function CheckoutSuccess() {
  const { id } = useParams();
  const { data, isPending } = useQuery({
    queryKey: ['checkout', id],
    queryFn: () => getCheckout(id!),
    enabled: isUuid(id),
  });
  if (!isUuid(id)) return <NotFound />;
  if (isPending) return <PageLoader />;
  if (!data) return <NotFound title="Order not found" />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="card hero-glow p-8 text-center animate-rise">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success text-white shadow-lift animate-pop">
          <CheckCircle2 className="size-9" />
        </div>
        <h1 className="mt-5 text-3xl font-extrabold">Order confirmed!</h1>
        <p className="mt-2 text-muted">
          You paid <strong className="text-ink">{formatPrice(data.total_cents)}</strong> on {formatDateTime(data.created_at)}.
        </p>
        <p className="mt-1 text-xs text-muted">
          Payment reference <span className="font-mono">{data.payment_ref}</span> (simulated)
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/orders">View orders</ButtonLink>
          <ButtonLink to="/" variant="outline">
            Keep browsing
          </ButtonLink>
        </div>
      </div>
      <div className="mt-8 space-y-5">
        {data.orders.map((o) => (
          <OrderCard key={o.id} order={o} perspective="buyer" />
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Questions about delivery? <Link to="/messages" className="font-semibold text-brand-ink hover:underline">Message the seller</Link>.
      </p>
    </div>
  );
}
