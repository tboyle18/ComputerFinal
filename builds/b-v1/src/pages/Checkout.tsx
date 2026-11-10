import { ArrowLeft, CreditCard, Lock, ShieldCheck, Sparkles, Truck } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../components/ui/Button'
import { PageLoader } from '../components/ui/Feedback'
import { Field, Input, Select } from '../components/ui/Field'
import { LogoMark } from '../components/ui/Logo'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { supabase } from '../lib/supabase'
import { cn, errorMessage, formatMoney } from '../lib/utils'
import { OrderSummary, useCartTotals } from './Cart'

const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Ireland', 'Australia', 'New Zealand', 'Germany', 'France', 'Netherlands', 'Spain', 'Other']

const TEST_CARD = '4242 4242 4242 4242'
const DECLINE_CARD = '4000000000000002'

function detectBrand(digits: string) {
  if (/^4/.test(digits)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard'
  if (/^3[47]/.test(digits)) return 'Amex'
  if (/^6(011|5)/.test(digits)) return 'Discover'
  return 'Card'
}

function luhn(digits: string) {
  let sum = 0
  let dbl = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i])
    if (dbl) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    dbl = !dbl
  }
  return digits.length >= 13 && sum % 10 === 0
}

function formatCard(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 19)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}

type Errors = Partial<Record<'name' | 'address' | 'city' | 'postcode' | 'card' | 'cardName' | 'expiry' | 'cvc', string>>

export default function Checkout() {
  const { profile, user } = useAuth()
  const cart = useCart()
  const totals = useCartTotals(cart.items)
  const navigate = useNavigate()

  const [shipping, setShipping] = useState({
    name: profile?.full_name ?? '',
    address: '',
    city: '',
    postcode: '',
    country: 'United States',
  })
  const [card, setCard] = useState({ number: '', name: profile?.full_name ?? '', expiry: '', cvc: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [stage, setStage] = useState<'form' | 'processing' | 'done'>('form')

  if (cart.loading && cart.items.length === 0) return <PageLoader />
  if (stage === 'form' && (totals.available.length === 0 || totals.unavailable.length > 0)) return <Navigate to="/cart" replace />

  const digits = card.number.replace(/\D/g, '')
  const brand = detectBrand(digits)

  const validate = (): Errors => {
    const e: Errors = {}
    if (!shipping.name.trim()) e.name = 'Required'
    if (!shipping.address.trim()) e.address = 'Required'
    if (!shipping.city.trim()) e.city = 'Required'
    if (!shipping.postcode.trim()) e.postcode = 'Required'
    if (!luhn(digits)) e.card = 'Enter a valid card number (try 4242 4242 4242 4242)'
    if (!card.name.trim()) e.cardName = 'Required'
    const [mm, yy] = card.expiry.split('/').map(Number)
    const now = new Date()
    const exp = mm && yy ? new Date(2000 + yy, mm, 0, 23, 59) : null
    if (!mm || mm < 1 || mm > 12 || !yy || !exp || exp < now) e.expiry = 'Invalid or expired'
    if (!/^\d{3,4}$/.test(card.cvc)) e.cvc = 'Invalid'
    return e
  }

  const pay = async (e: FormEvent) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length) return

    setStage('processing')
    await new Promise((r) => setTimeout(r, 1400)) // pretend to talk to a payment processor

    if (digits === DECLINE_CARD) {
      setStage('form')
      toast.error('Your card was declined. Try a different card.')
      return
    }

    const { data, error } = await supabase.rpc('place_order', {
      p_shipping_name: shipping.name,
      p_shipping_address: shipping.address,
      p_shipping_city: shipping.city,
      p_shipping_postcode: shipping.postcode,
      p_shipping_country: shipping.country,
      p_payment_brand: brand,
      p_payment_last4: digits.slice(-4),
    })

    if (error || !data) {
      setStage('form')
      toast.error(errorMessage(error, 'Payment failed'))
      await cart.refresh()
      return
    }

    setStage('done')
    await cart.refresh()
    navigate(`/orders/${data}?placed=1`, { replace: true })
  }

  const setS = (k: keyof typeof shipping) => (e: { target: { value: string } }) => {
    setShipping((s) => ({ ...s, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <Link to="/cart" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Back to cart
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Checkout</h1>

      <form onSubmit={pay} className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_400px]" noValidate>
        <div className="space-y-6">
          <section className="rounded-3xl border border-line bg-surface p-6 sm:p-7">
            <h2 className="flex items-center gap-2 font-semibold">
              <Truck className="size-4 text-muted" /> Shipping address
            </h2>
            <p className="mt-1 text-sm text-muted">Confirmation goes to {user?.email}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="name" error={errors.name} className="sm:col-span-2">
                <Input id="name" autoComplete="name" value={shipping.name} onChange={setS('name')} aria-invalid={Boolean(errors.name)} />
              </Field>
              <Field label="Street address" htmlFor="address" error={errors.address} className="sm:col-span-2">
                <Input id="address" autoComplete="street-address" value={shipping.address} onChange={setS('address')} placeholder="123 Market Street, Apt 4" aria-invalid={Boolean(errors.address)} />
              </Field>
              <Field label="City" htmlFor="city" error={errors.city}>
                <Input id="city" autoComplete="address-level2" value={shipping.city} onChange={setS('city')} aria-invalid={Boolean(errors.city)} />
              </Field>
              <Field label="ZIP / Postcode" htmlFor="postcode" error={errors.postcode}>
                <Input id="postcode" autoComplete="postal-code" value={shipping.postcode} onChange={setS('postcode')} aria-invalid={Boolean(errors.postcode)} />
              </Field>
              <Field label="Country" htmlFor="country" className="sm:col-span-2">
                <Select id="country" autoComplete="country-name" value={shipping.country} onChange={setS('country')}>
                  {COUNTRIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>

          <section className="rounded-3xl border border-line bg-surface p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold">
                <CreditCard className="size-4 text-muted" /> Payment
              </h2>
              <button
                type="button"
                onClick={() => {
                  setCard((c) => ({ ...c, number: TEST_CARD, expiry: '12/30', cvc: '123', name: c.name || shipping.name }))
                  setErrors((er) => ({ ...er, card: undefined, expiry: undefined, cvc: undefined, cardName: undefined }))
                }}
                className="flex items-center gap-1.5 rounded-full bg-accent/30 px-3 py-1 text-xs font-medium text-ink transition hover:bg-accent/50"
              >
                <Sparkles className="size-3" /> Use test card
              </button>
            </div>

            <div className="mt-5 grid gap-6 md:grid-cols-[1fr_260px]">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Card number" htmlFor="card" error={errors.card} className="sm:col-span-2">
                  <div className="relative">
                    <Input
                      id="card"
                      inputMode="numeric"
                      autoComplete="off"
                      value={card.number}
                      onChange={(e) => {
                        setCard((c) => ({ ...c, number: formatCard(e.target.value) }))
                        setErrors((er) => ({ ...er, card: undefined }))
                      }}
                      placeholder="1234 1234 1234 1234"
                      className="pr-24 font-mono tracking-wide"
                      aria-invalid={Boolean(errors.card)}
                    />
                    <span className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">
                      {brand}
                    </span>
                  </div>
                </Field>
                <Field label="Name on card" htmlFor="cardName" error={errors.cardName} className="sm:col-span-2">
                  <Input id="cardName" autoComplete="off" value={card.name} onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))} aria-invalid={Boolean(errors.cardName)} />
                </Field>
                <Field label="Expiry" htmlFor="expiry" error={errors.expiry}>
                  <Input
                    id="expiry"
                    inputMode="numeric"
                    autoComplete="off"
                    value={card.expiry}
                    onChange={(e) => setCard((c) => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                    placeholder="MM/YY"
                    className="font-mono"
                    aria-invalid={Boolean(errors.expiry)}
                  />
                </Field>
                <Field label="CVC" htmlFor="cvc" error={errors.cvc}>
                  <Input
                    id="cvc"
                    inputMode="numeric"
                    autoComplete="off"
                    value={card.cvc}
                    onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    placeholder="123"
                    className="font-mono"
                    aria-invalid={Boolean(errors.cvc)}
                  />
                </Field>
              </div>

              <CardPreview number={card.number} name={card.name} expiry={card.expiry} brand={brand} />
            </div>

            <div className="mt-5 flex gap-3 rounded-2xl bg-surface-2/70 p-4 text-[13px] leading-relaxed text-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
              <p>
                <span className="font-medium text-ink">This is a demo checkout.</span> No real payment is processed and card numbers are never
                stored — only the last four digits are saved with your order. Use <span className="font-mono text-ink">4242 4242 4242 4242</span>{' '}
                to succeed or <span className="font-mono text-ink">4000 0000 0000 0002</span> to see a decline.
              </p>
            </div>
          </section>
        </div>

        <OrderSummary totals={totals} items={totals.available}>
          <Button type="submit" size="lg" variant="accent" className="w-full" disabled={stage !== 'form'}>
            <Lock /> Pay {formatMoney(totals.total)}
          </Button>
        </OrderSummary>
      </form>

      <AnimatePresence>
        {stage !== 'form' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-canvas/80 backdrop-blur-md"
          >
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="flex flex-col items-center text-center">
              <div className="relative flex size-20 items-center justify-center">
                <motion.span
                  className="absolute inset-0 rounded-full border-[3px] border-line border-t-ink"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
                />
                <LogoMark className="size-10" />
              </div>
              <p className="mt-6 text-lg font-semibold">Processing payment…</p>
              <p className="mt-1 text-sm text-muted">Securely placing your order with {totals.sellers === 1 ? 'the seller' : `${totals.sellers} sellers`}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CardPreview({ number, name, expiry, brand }: { number: string; name: string; expiry: string; brand: string }) {
  const digits = number.replace(/\D/g, '')
  const masked = (digits.padEnd(16, '•').match(/.{1,4}/g) ?? []).join(' ')
  return (
    <div
      className={cn(
        'relative hidden aspect-[1.586] w-full self-start overflow-hidden rounded-2xl p-5 text-white shadow-lift md:block',
        'bg-[radial-gradient(120%_120%_at_100%_0%,#c6f15a55,transparent_50%),linear-gradient(135deg,#1b1b19,#2e2e2a)]',
      )}
    >
      <div className="dotted-bg absolute inset-0 opacity-60" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="h-7 w-9 rounded-md bg-linear-to-br from-[#f5e3a1] to-[#c9a64b] opacity-90" />
          <span className="text-sm font-semibold tracking-wide italic">{brand}</span>
        </div>
        <p className="font-mono text-[15px] tracking-[0.12em]">{masked}</p>
        <div className="flex items-end justify-between text-[10px] uppercase">
          <div className="min-w-0">
            <p className="text-white/50">Card holder</p>
            <p className="truncate text-[12px] tracking-wide">{name || 'Your name'}</p>
          </div>
          <div className="text-right">
            <p className="text-white/50">Expires</p>
            <p className="font-mono text-[12px]">{expiry || 'MM/YY'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
