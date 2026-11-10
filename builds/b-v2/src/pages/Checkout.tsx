import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Lock, ShieldCheck } from 'lucide-react';
import { checkout, isAvailable } from '../api/commerce';
import { useAuth } from '../auth/AuthProvider';
import { keys, useCart } from '../hooks/queries';
import { formatPrice } from '../lib/format';
import { imageUrl } from '../lib/images';
import { friendlyError } from '../lib/errors';
import { fieldErrors, shippingSchema, type Shipping } from '../lib/validation';
import { COUNTRIES } from '../lib/countries';
import { useToast } from '../components/Toast';
import { LogoMark } from '../components/Logo';
import { Alert, Button, Field, Input, PageLoader, Select } from '../components/ui';

export function Checkout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: cart, isPending } = useCart();
  // SECURITY: one idempotency key per checkout attempt. Double-clicks, retries
  // or a flaky network can never create a second order or charge twice.
  const idempotencyKey = useRef(crypto.randomUUID());
  // PRIVACY: the address lives only in memory; it's never written to
  // localStorage or other browser storage.
  const [ship, setShip] = useState<Shipping>({
    name: '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    postal_code: '',
    country: 'US',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const items = useMemo(() => (cart ?? []).filter(isAvailable), [cart]);
  const total = items.reduce((s, r) => s + (r.listing?.price_cents ?? 0), 0);

  const pay = useMutation({
    mutationFn: (shipping: Shipping) => checkout(idempotencyKey.current, total, shipping),
    onSuccess: (checkoutId) => {
      void queryClient.invalidateQueries({ queryKey: keys.cart(user!.id) });
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
      void queryClient.invalidateQueries({ queryKey: keys.orders(user!.id, 'buyer') });
      navigate(`/checkout/success/${checkoutId}`, { replace: true });
    },
    onError: (err: unknown) => {
      const code = (err as { code?: string }).code;
      if (code === 'PT409') {
        // Prices or availability changed: refresh the cart and let the buyer
        // review the new total before trying again (with a new key).
        void queryClient.invalidateQueries({ queryKey: keys.cart(user!.id) });
        idempotencyKey.current = crypto.randomUUID();
      }
      setFormError(friendlyError(err, 'Payment failed. You have not been charged.'));
      toast.error('Checkout didn’t go through.');
    },
  });

  if (isPending) return <PageLoader />;
  // While paying / after success the cart empties; don't bounce back to /cart.
  if (pay.isPending || pay.isSuccess) return <PageLoader />;
  if (!cart || items.length === 0 || items.length !== cart.length) return <Navigate to="/cart" replace />;

  const set = (k: keyof Shipping) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setShip((s) => ({ ...s, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = shippingSchema.safeParse(ship);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    pay.mutate(parsed.data);
  };

  const input = (k: keyof Shipping, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label} error={errors[k]}>
      {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={!!errors[k]} value={ship[k]} onChange={set(k)} {...props} />}
    </Field>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold">Checkout</h1>
      <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]" noValidate>
        <div className="space-y-6">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <section className="card space-y-5 p-6">
            <h2 className="text-lg font-semibold">Shipping address</h2>
            <p className="-mt-3 text-sm text-muted">Shared only with the seller(s) of these items so they can ship your order.</p>
            {input('name', 'Full name', { autoComplete: 'shipping name', maxLength: 100 })}
            {input('line1', 'Address', { autoComplete: 'shipping address-line1', maxLength: 200 })}
            {input('line2', 'Apartment, suite, etc. (optional)', { autoComplete: 'shipping address-line2', maxLength: 200 })}
            <div className="grid gap-5 sm:grid-cols-2">
              {input('city', 'City', { autoComplete: 'shipping address-level2', maxLength: 100 })}
              {input('region', 'State / region', { autoComplete: 'shipping address-level1', maxLength: 100 })}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {input('postal_code', 'Postal code', { autoComplete: 'shipping postal-code', maxLength: 11 })}
              <Field label="Country" error={errors.country}>
                {(id) => (
                  <Select id={id} value={ship.country} onChange={set('country')} autoComplete="shipping country">
                    {COUNTRIES.map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CreditCard className="size-5 text-brand" /> Payment
            </h2>
            <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-[#2b1f7a] via-[#4b33e6] to-[#ff7a50] p-5 text-white shadow-lift">
              <div className="flex items-center justify-between">
                <LogoMark className="size-7" />
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold backdrop-blur">DEMO</span>
              </div>
              <p className="mt-8 font-mono text-lg tracking-widest opacity-90">•••• •••• •••• DEMO</p>
              <p className="mt-2 text-sm opacity-80">Curio Simulated Pay</p>
            </div>
            <p className="mt-4 flex items-start gap-2 text-sm text-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
              This is a demo marketplace: payment is simulated and no card details are requested or stored. Handling real
              cards requires a PCI-compliant processor (e.g. Stripe) so card numbers never touch our servers.
            </p>
          </section>
        </div>

        <aside className="card h-fit p-6 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">Order summary</h2>
          <ul className="mt-4 space-y-3">
            {items.map((r) => {
              const img = imageUrl('listing-images', r.listing?.image_paths[0]);
              return (
                <li key={r.listing_id} className="flex items-center gap-3">
                  <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {img && <img src={img} alt="" className="size-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">{r.listing?.title}</p>
                    <p className="text-xs text-muted">from {r.listing?.seller?.display_name}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatPrice(r.listing?.price_cents ?? 0)}</p>
                </li>
              );
            })}
          </ul>
          <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Shipping</dt>
              <dd className="text-success">Free</dd>
            </div>
            <div className="flex justify-between pt-2 text-base">
              <dt className="font-semibold">Total</dt>
              <dd className="font-display text-2xl font-extrabold">{formatPrice(total)}</dd>
            </div>
          </dl>
          <Button type="submit" size="lg" className="mt-6 w-full" loading={pay.isPending} icon={<Lock className="size-4" />}>
            Pay {formatPrice(total)}
          </Button>
          <p className="mt-3 text-center text-xs text-muted">The total is verified by our server before your order is placed.</p>
        </aside>
      </form>
    </div>
  );
}
