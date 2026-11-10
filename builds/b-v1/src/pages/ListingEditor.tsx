import { ArrowLeft, Check, Lightbulb, MapPin, Tag } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { PageContainer } from '../components/layout/Layout'
import { ImageUploader, previewOf, type UploadItem } from '../components/listings/ImageUploader'
import { Button } from '../components/ui/Button'
import { EmptyState, PageLoader } from '../components/ui/Feedback'
import { Field, Input, Textarea } from '../components/ui/Field'
import { useAuth } from '../context/AuthContext'
import { CATEGORIES } from '../lib/categories'
import { removeListingImages, uploadListingImage } from '../lib/images'
import { supabase } from '../lib/supabase'
import type { Condition, Listing } from '../lib/types'
import { cn, CONDITIONS, conditionLabel, errorMessage, formatPrice } from '../lib/utils'

type FormState = {
  title: string
  description: string
  price: string
  category: string
  condition: Condition
  location: string
}

type Errors = Partial<Record<keyof FormState | 'images', string>>

export default function ListingEditor() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: 'good',
    location: profile?.location ?? '',
  })
  const [images, setImages] = useState<UploadItem[]>([])
  const [original, setOriginal] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [forbidden, setForbidden] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (!data || data.seller_id !== user?.id) {
          setForbidden(true)
        } else {
          setOriginal(data)
          setForm({
            title: data.title,
            description: data.description,
            price: String(data.price),
            category: data.category,
            condition: data.condition as Condition,
            location: data.location,
          })
          setImages(data.images.map((path) => ({ id: crypto.randomUUID(), kind: 'existing' as const, path })))
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, user?.id])

  // Free object URLs when leaving the page.
  useEffect(
    () => () => {
      images.forEach((i) => i.kind === 'new' && URL.revokeObjectURL(i.preview))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const validate = (): Errors => {
    const e: Errors = {}
    if (form.title.trim().length < 3) e.title = 'Give your listing a title (at least 3 characters)'
    if (form.title.length > 100) e.title = 'Keep the title under 100 characters'
    const price = Number(form.price)
    if (form.price === '' || Number.isNaN(price) || price < 0) e.price = 'Enter a valid price'
    else if (price > 1_000_000) e.price = 'That’s a little steep — max $1,000,000'
    if (!form.category) e.category = 'Pick a category'
    if (images.length === 0) e.images = 'Add at least one photo — listings with photos sell much faster'
    if (form.description.length > 5000) e.description = 'Description is too long'
    return e
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!user) return
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) {
      toast.error('Please fix the highlighted fields')
      return
    }

    try {
      const newOnes = images.filter((i) => i.kind === 'new')
      const uploaded = new Map<string, string>()
      let done = 0
      setSaving(newOnes.length ? `Uploading photos 0/${newOnes.length}` : 'Saving…')
      await Promise.all(
        newOnes.map(async (item) => {
          if (item.kind !== 'new') return
          const path = await uploadListingImage(user.id, item.file)
          uploaded.set(item.id, path)
          done += 1
          setSaving(`Uploading photos ${done}/${newOnes.length}`)
        }),
      )
      setSaving('Saving…')

      const paths = images.map((i) => (i.kind === 'existing' ? i.path : uploaded.get(i.id)!))
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        price: Math.round(Number(form.price) * 100) / 100,
        category: form.category,
        condition: form.condition,
        location: form.location.trim(),
        images: paths,
      }

      if (isEdit && original) {
        const { error } = await supabase.from('listings').update(payload).eq('id', original.id)
        if (error) throw error
        const removed = original.images.filter((p) => !paths.includes(p))
        if (removed.length) await removeListingImages(removed)
        toast.success('Listing updated')
        navigate(`/listing/${original.id}`)
      } else {
        const { data, error } = await supabase
          .from('listings')
          .insert({ ...payload, seller_id: user.id })
          .select('id')
          .single()
        if (error) {
          await removeListingImages([...uploaded.values()])
          throw error
        }
        toast.success('Your listing is live!')
        navigate(`/listing/${data.id}`)
      }
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(null)
    }
  }

  const preview = useMemo(
    () => ({
      title: form.title || 'Your item title',
      price: Number(form.price) || 0,
      image: images[0] ? previewOf(images[0]) : null,
      condition: form.condition,
      location: form.location,
    }),
    [form, images],
  )

  if (loading) return <PageLoader />
  if (forbidden) {
    return (
      <PageContainer className="py-16">
        <EmptyState icon={Tag} title="You can’t edit this listing" description="Only the seller can make changes to a listing." />
      </PageContainer>
    )
  }

  return (
    <PageContainer className="pt-6">
      <Link to={isEdit && original ? `/listing/${original.id}` : '/'} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {isEdit ? 'Back to listing' : 'Back to marketplace'}
      </Link>

      <div className="mt-4 mb-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {isEdit ? 'Edit listing' : (
            <>
              What are you <span className="font-display font-normal italic">selling</span> today?
            </>
          )}
        </h1>
        <p className="mt-2 text-muted">
          {isEdit ? 'Update the details below — changes go live immediately.' : 'Great photos and an honest description go a long way.'}
        </p>
      </div>

      <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_340px]" noValidate>
        <div className="space-y-8">
          <Section title="Photos" step={1}>
            <ImageUploader value={images} onChange={(v) => { setImages(v); if (errors.images) setErrors((e) => ({ ...e, images: undefined })) }} error={errors.images} />
          </Section>

          <Section title="The basics" step={2}>
            <div className="space-y-5">
              <Field label="Title" htmlFor="title" error={errors.title} aside={`${form.title.length}/100`}>
                <Input
                  id="title"
                  value={form.title}
                  maxLength={100}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="e.g. Vintage 35mm film camera with leather case"
                  aria-invalid={Boolean(errors.title)}
                />
              </Field>
              <Field
                label="Description"
                htmlFor="description"
                error={errors.description}
                aside={`${form.description.length}/5000`}
                hint="Mention brand, size, age, any flaws, and what’s included."
              >
                <Textarea
                  id="description"
                  rows={6}
                  value={form.description}
                  maxLength={5000}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Tell buyers what makes it great — and be upfront about wear and tear."
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Price" htmlFor="price" error={errors.price}>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[15px] font-medium text-muted">$</span>
                    <Input
                      id="price"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={form.price}
                      onChange={(e) => set('price', e.target.value)}
                      placeholder="0.00"
                      className="pl-8 font-medium tabular-nums"
                      aria-invalid={Boolean(errors.price)}
                    />
                  </div>
                </Field>
                <Field label="Location" htmlFor="location" hint="City or neighbourhood — never your full address.">
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
                    <Input
                      id="location"
                      value={form.location}
                      maxLength={80}
                      onChange={(e) => set('location', e.target.value)}
                      placeholder="Brooklyn, NY"
                      className="pl-10"
                    />
                  </div>
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Category" step={3}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {CATEGORIES.map((c) => {
                const active = form.category === c.slug
                return (
                  <button
                    type="button"
                    key={c.slug}
                    onClick={() => set('category', c.slug)}
                    className={cn(
                      'relative flex flex-col items-start gap-3 rounded-2xl border p-3.5 text-left text-sm font-medium transition',
                      active ? 'border-ink bg-ink text-canvas shadow-soft' : 'border-line bg-surface hover:border-line-strong',
                    )}
                    aria-pressed={active}
                  >
                    <span
                      className="flex size-9 items-center justify-center rounded-xl"
                      style={{ background: active ? 'rgb(255 255 255 / 0.12)' : `${c.tint}22`, color: active ? undefined : c.tint }}
                    >
                      <c.icon className="size-[18px]" />
                    </span>
                    <span className="leading-tight">{c.name}</span>
                    {active && <Check className="absolute top-3 right-3 size-4 text-accent" />}
                  </button>
                )
              })}
            </div>
            {errors.category && <p className="mt-2 text-[13px] text-danger">{errors.category}</p>}
          </Section>

          <Section title="Condition" step={4}>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {CONDITIONS.map((c) => {
                const active = form.condition === c.value
                return (
                  <label
                    key={c.value}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition',
                      active ? 'border-ink bg-surface ring-1 ring-ink' : 'border-line bg-surface hover:border-line-strong',
                    )}
                  >
                    <input
                      type="radio"
                      name="condition"
                      value={c.value}
                      checked={active}
                      onChange={() => set('condition', c.value)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition',
                        active ? 'border-ink bg-ink' : 'border-line-strong',
                      )}
                    >
                      {active && <span className="size-1.5 rounded-full bg-canvas" />}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{c.label}</span>
                      <span className="mt-0.5 block text-[13px] text-muted">{c.hint}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </Section>

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
            <Button variant="ghost" size="lg" onClick={() => navigate(-1)} disabled={Boolean(saving)}>
              Cancel
            </Button>
            <Button type="submit" size="lg" variant={isEdit ? 'primary' : 'accent'} disabled={Boolean(saving)} className="min-w-48">
              {saving ?? (isEdit ? 'Save changes' : 'Publish listing')}
            </Button>
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">Live preview</p>
            <div className="rounded-3xl border border-line bg-surface p-3 shadow-soft">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface-2">
                {preview.image ? (
                  <img src={preview.image} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-2 text-muted">
                    <Tag className="size-8" strokeWidth={1.5} />
                    <span className="text-sm">Your cover photo</span>
                  </div>
                )}
                {(preview.condition === 'new' || preview.condition === 'like_new') && (
                  <span className="absolute bottom-2.5 left-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-neutral-900">
                    {conditionLabel(preview.condition)}
                  </span>
                )}
              </div>
              <div className="px-1.5 pt-3 pb-1.5">
                <div className="flex items-baseline justify-between">
                  <p className="text-[17px] font-semibold tabular-nums">{formatPrice(preview.price)}</p>
                  <span className="text-xs text-muted">just now</span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-sm text-ink-2">{preview.title}</p>
                {preview.location && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                    <MapPin className="size-3" /> {preview.location}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5 rounded-3xl border border-line bg-surface-2/50 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="size-4 text-warning" /> Tips for a quick sale
              </p>
              <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-muted">
                <li>• Shoot in daylight against a plain background.</li>
                <li>• Show any flaws up close — honesty builds trust.</li>
                <li>• Price ~20–30% below retail for used items.</li>
                <li>• Reply to messages quickly; buyers move fast.</li>
              </ul>
            </div>
          </div>
        </aside>
      </form>
    </PageContainer>
  )
}

function Section({ title, step, children }: { title: string; step: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold tracking-tight">
        <span className="flex size-7 items-center justify-center rounded-full bg-surface-2 text-[13px] font-semibold text-ink-2 tabular-nums">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}
