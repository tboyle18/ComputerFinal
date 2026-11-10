import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Lightbulb, ShieldCheck } from 'lucide-react';
import { createListing, getListing, updateListing, type Condition, type ListingInput } from '../api/listings';
import { useAuth } from '../auth/AuthProvider';
import { keys } from '../hooks/queries';
import { useCategories } from '../lib/categories';
import { CONDITION_LABELS, isUuid, parsePriceToCents } from '../lib/format';
import { processImage, removeImages, uploadImage } from '../lib/images';
import { friendlyError } from '../lib/errors';
import { fieldErrors, listingSchema } from '../lib/validation';
import { ImageManager, type PhotoItem } from '../components/ImageManager';
import { useToast } from '../components/Toast';
import { Alert, Button, Field, Input, PageLoader, Select, Textarea, cx } from '../components/ui';
import { NotFound } from './NotFound';

interface FormState {
  title: string;
  description: string;
  price: string;
  category: string;
  condition: Condition;
  location: string;
}

const EMPTY: FormState = { title: '', description: '', price: '', category: '', condition: 'good', location: '' };

export function ListingEditor() {
  const { id } = useParams();
  const editing = id !== undefined;
  const { user } = useAuth();
  const { data: existing, isPending } = useQuery({
    queryKey: keys.listing(id ?? 'new'),
    queryFn: () => getListing(id!),
    enabled: editing && isUuid(id),
  });

  if (editing) {
    if (!isUuid(id)) return <NotFound />;
    if (isPending) return <PageLoader />;
    // UX only: RLS would reject edits by anyone but the owner anyway.
    if (!existing || existing.seller_id !== user?.id) return <NotFound title="Listing not found" />;
    if (existing.status !== 'active') {
      return <NotFound title="This listing can’t be edited" message="Sold and removed listings are locked." />;
    }
    return (
      <EditorForm
        listingId={existing.id}
        initial={{
          title: existing.title,
          description: existing.description,
          price: (existing.price_cents / 100).toFixed(2),
          category: existing.category,
          condition: existing.condition,
          location: existing.location,
        }}
        initialPhotos={existing.image_paths.map((path) => ({ kind: 'existing' as const, key: path, path }))}
      />
    );
  }
  return <EditorForm initial={EMPTY} initialPhotos={[]} />;
}

function EditorForm({
  listingId,
  initial,
  initialPhotos,
}: {
  listingId?: string;
  initial: FormState;
  initialPhotos: PhotoItem[];
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: categories } = useCategories();
  const [form, setForm] = useState<FormState>(initial);
  const [photos, setPhotos] = useState<PhotoItem[]>(initialPhotos);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const busy = status !== null;

  useEffect(() => {
    document.title = `${listingId ? 'Edit listing' : 'Sell an item'} · Curio`;
  }, [listingId]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const priceCents = parsePriceToCents(form.price);
    const parsed = listingSchema.safeParse({ ...form, price_cents: priceCents ?? Number.NaN });
    const errs = parsed.success ? {} : fieldErrors(parsed.error);
    if (priceCents === null) errs.price_cents = 'Enter a price like 25 or 24.99.';
    if (photos.length === 0) errs.photos = 'Add at least one photo.';
    if (!parsed.success || Object.keys(errs).length) {
      setErrors(errs);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setErrors({});

    const uploaded: string[] = [];
    try {
      // 1. Process + upload new photos (EXIF/GPS stripped in processImage).
      const finalPaths: string[] = [];
      const newCount = photos.filter((p) => p.kind === 'new').length;
      let done = 0;
      for (const p of photos) {
        if (p.kind === 'existing') {
          finalPaths.push(p.path);
          continue;
        }
        setStatus(`Uploading photo ${++done} of ${newCount}…`);
        const blob = await processImage(p.file, 'listing-images');
        const path = await uploadImage('listing-images', user!.id, blob);
        uploaded.push(path);
        finalPaths.push(path);
      }

      // 2. Save the listing. Price is integer cents; seller comes from the session.
      setStatus('Saving…');
      const input: ListingInput = {
        title: parsed.data.title,
        description: parsed.data.description,
        price_cents: parsed.data.price_cents,
        category: parsed.data.category,
        condition: parsed.data.condition,
        location: parsed.data.location,
        image_paths: finalPaths,
      };
      let id = listingId;
      if (listingId) {
        await updateListing(listingId, input);
        // 3. Clean up photos the seller removed.
        const removed = initialPhotos
          .filter((p): p is Extract<PhotoItem, { kind: 'existing' }> => p.kind === 'existing')
          .map((p) => p.path)
          .filter((p) => !finalPaths.includes(p));
        await removeImages('listing-images', removed);
      } else {
        id = await createListing(input);
      }

      for (const p of photos) if (p.kind === 'new') URL.revokeObjectURL(p.preview);
      await queryClient.invalidateQueries({ queryKey: ['listings'] });
      await queryClient.invalidateQueries({ queryKey: keys.listing(id!) });
      await queryClient.invalidateQueries({ queryKey: keys.myListings(user!.id) });
      toast.success(listingId ? 'Listing updated.' : 'Your listing is live!');
      navigate(`/listing/${id}`);
    } catch (err) {
      // Don't leave orphaned uploads behind if saving failed.
      await removeImages('listing-images', uploaded);
      setFormError(friendlyError(err, 'We couldn’t save your listing. Please try again.'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setStatus(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold">{listingId ? 'Edit listing' : 'Sell an item'}</h1>
      <p className="mt-1 text-muted">Great photos and an honest description sell items faster.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={submit} className="space-y-6" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}

          <section className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Camera className="size-5 text-brand" /> Photos
            </h2>
            <ImageManager items={photos} onChange={setPhotos} error={errors.photos} />
          </section>

          <section className="card space-y-5 p-6">
            <h2 className="text-lg font-semibold">Details</h2>
            <Field label="Title" error={errors.title} counter={{ value: form.title.length, max: 100 }}>
              {(id, d) => (
                <Input
                  id={id}
                  aria-describedby={d}
                  aria-invalid={!!errors.title}
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Canon AE-1 film camera with 50mm lens"
                />
              )}
            </Field>
            <Field label="Description" error={errors.description} counter={{ value: form.description.length, max: 5000 }}>
              {(id, d) => (
                <Textarea
                  id={id}
                  aria-describedby={d}
                  aria-invalid={!!errors.description}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  maxLength={5000}
                  rows={7}
                  placeholder="Condition, size, age, what’s included, any flaws…"
                />
              )}
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Category" error={errors.category}>
                {(id, d) => (
                  <Select
                    id={id}
                    aria-describedby={d}
                    aria-invalid={!!errors.category}
                    value={form.category}
                    onChange={(e) => set('category', e.target.value)}
                  >
                    <option value="" disabled>
                      Choose a category
                    </option>
                    {categories?.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Condition" error={errors.condition}>
                {(id) => (
                  <Select id={id} value={form.condition} onChange={(e) => set('condition', e.target.value as Condition)}>
                    {Object.entries(CONDITION_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </section>

          <section className="card grid gap-5 p-6 sm:grid-cols-2">
            <Field label="Price (USD)" error={errors.price_cents}>
              {(id, d) => (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-muted">$</span>
                  <Input
                    id={id}
                    aria-describedby={d}
                    aria-invalid={!!errors.price_cents}
                    inputMode="decimal"
                    value={form.price}
                    onChange={(e) => set('price', e.target.value)}
                    maxLength={12}
                    placeholder="0.00"
                    className="pl-8 font-semibold"
                  />
                </div>
              )}
            </Field>
            <Field label="Location (optional)" error={errors.location} hint="City or neighbourhood. Never your street address.">
              {(id, d) => (
                <Input
                  id={id}
                  aria-describedby={d}
                  value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                  maxLength={80}
                  placeholder="e.g. Brooklyn, NY"
                />
              )}
            </Field>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" size="lg" onClick={() => navigate(-1)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" size="lg" loading={busy} className="sm:min-w-48">
              {status ?? (listingId ? 'Save changes' : 'Publish listing')}
            </Button>
          </div>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h3 className="flex items-center gap-2 font-semibold">
              <Lightbulb className="size-5 text-warning" /> Selling tips
            </h3>
            <ul className="mt-3 space-y-2.5 text-sm text-muted">
              {[
                'Use natural light and show any flaws honestly.',
                'Put the most important words first in the title.',
                'Mention brand, model, size and age.',
                'Price competitively: check similar listings.',
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className={cx('rounded-2xl border border-line p-5 text-sm', 'bg-success-soft/50')}>
            <p className="flex items-center gap-2 font-semibold text-ink">
              <ShieldCheck className="size-4 text-success" /> Your privacy
            </p>
            <p className="mt-1.5 text-muted">
              Buyers see your display name and city only. Your email and address stay private.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
