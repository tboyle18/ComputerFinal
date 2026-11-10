import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  ImageOff,
  MapPin,
  MessageCircle,
  Pencil,
  ShieldCheck,
  ShieldX,
  ShoppingBag,
  Tag,
  Trash2,
} from 'lucide-react';
import { deleteListing, getListing, reportListing, searchListings, type ListingDetail as Detail } from '../api/listings';
import { addToCart } from '../api/commerce';
import { sendMessage, startConversation } from '../api/messages';
import { setListingStatus } from '../api/admin';
import { useAuth } from '../auth/AuthProvider';
import { keys, useAdminStatus, useCart } from '../hooks/queries';
import { useCategoryName } from '../lib/categories';
import { CONDITION_LABELS, formatMonthYear, formatPrice, isUuid, timeAgo } from '../lib/format';
import { imageUrl } from '../lib/images';
import { friendlyError } from '../lib/errors';
import { MESSAGE_MAX } from '../lib/validation';
import { useToast } from '../components/Toast';
import { ListingCard } from '../components/ListingCard';
import { Alert, Avatar, Badge, Button, ButtonLink, Field, Modal, PageLoader, Select, Textarea, cx } from '../components/ui';
import { NotFound } from './NotFound';

export function ListingDetail() {
  const { id } = useParams();
  const validId = isUuid(id) ? id : null;
  const { data: listing, isPending, isError, error } = useQuery({
    queryKey: keys.listing(validId ?? 'invalid'),
    queryFn: () => getListing(validId!),
    enabled: !!validId,
  });

  if (!validId) return <NotFound />;
  if (isPending) return <PageLoader />;
  if (isError)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Alert tone="danger">{friendlyError(error)}</Alert>
      </div>
    );
  if (!listing) return <NotFound title="Listing not found" message="It may have been sold, removed or never existed." />;
  return <ListingView listing={listing} />;
}

function ListingView({ listing }: { listing: Detail }) {
  const { user } = useAuth();
  const categoryName = useCategoryName();
  const isOwner = user?.id === listing.seller_id;
  const sellerName = listing.seller?.display_name ?? 'Curio seller';

  useEffect(() => {
    document.title = `${listing.title} · Curio`;
    return () => {
      document.title = 'Curio · Find something worth keeping';
    };
  }, [listing.title]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-6 flex items-center gap-2 text-sm text-muted" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-ink">
          Home
        </Link>
        <ChevronRight className="size-3.5" />
        <Link to={`/?category=${encodeURIComponent(listing.category)}`} className="hover:text-ink">
          {categoryName(listing.category)}
        </Link>
      </nav>

      {listing.status === 'sold' && (
        <div className="mb-6">
          <Alert tone="neutral" icon={<Check className="size-4" />}>
            This item has been sold{listing.sold_at ? ` ${timeAgo(listing.sold_at)}` : ''}.
          </Alert>
        </div>
      )}
      {listing.status === 'removed' && (
        <div className="mb-6">
          <Alert tone="danger" icon={<ShieldX className="size-4" />}>
            <strong>Removed by a moderator.</strong> Only you{isOwner ? '' : ' and the seller'} can see this listing.
            {listing.removed_reason && <> Reason: {listing.removed_reason}</>}
          </Alert>
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Gallery paths={listing.image_paths} title={listing.title} />
          <section className="mt-10">
            <h2 className="text-xl font-bold">About this item</h2>
            {/* Rendered as plain text: React escapes it, and we never use
                dangerouslySetInnerHTML, so user content can't inject HTML. */}
            <p className="mt-4 whitespace-pre-wrap break-words leading-relaxed text-ink/90">{listing.description}</p>
            <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl bg-surface-2 p-5 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted">Condition</dt>
                <dd className="mt-0.5 font-semibold">{CONDITION_LABELS[listing.condition]}</dd>
              </div>
              <div>
                <dt className="text-muted">Category</dt>
                <dd className="mt-0.5 font-semibold">{categoryName(listing.category)}</dd>
              </div>
              <div>
                <dt className="text-muted">Listed</dt>
                <dd className="mt-0.5 font-semibold">{timeAgo(listing.created_at)}</dd>
              </div>
            </dl>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <div className="flex flex-wrap gap-2">
              <Badge tone="brand">
                <Tag className="size-3" /> {CONDITION_LABELS[listing.condition]}
              </Badge>
              {listing.status === 'sold' && <Badge>Sold</Badge>}
            </div>
            <h1 className="mt-3 break-words text-2xl font-bold leading-tight sm:text-3xl">{listing.title}</h1>
            <p className="mt-3 font-display text-4xl font-extrabold">{formatPrice(listing.price_cents)}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              {listing.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" /> {listing.location}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="size-4" /> {timeAgo(listing.created_at)}
              </span>
            </div>
            <div className="mt-6">
              <Actions listing={listing} isOwner={isOwner} />
            </div>
          </div>

          <Link
            to={`/u/${listing.seller_id}`}
            className="card mt-4 flex items-center gap-4 p-5 transition hover:border-ink/20"
          >
            <Avatar name={sellerName} path={listing.seller?.avatar_path} size={48} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{sellerName}</p>
              <p className="text-sm text-muted">
                {listing.seller ? `Member since ${formatMonthYear(listing.seller.created_at)}` : 'Seller'}
              </p>
            </div>
            <ChevronRight className="size-5 text-muted" />
          </Link>

          <div className="mt-4 flex gap-3 rounded-2xl border border-line bg-success-soft/50 p-4 text-sm">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" />
            <p className="text-ink/80">
              <strong className="text-ink">Stay safe:</strong> pay through Curio checkout and keep chats on Curio. Never share
              passwords, card numbers or one-time codes.
            </p>
          </div>

          {user && !isOwner && <ReportButton listingId={listing.id} />}
        </aside>
      </div>

      <MoreFromSeller sellerId={listing.seller_id} excludeId={listing.id} sellerName={sellerName} />
    </div>
  );
}

function Gallery({ paths, title }: { paths: string[]; title: string }) {
  const urls = paths.map((p) => imageUrl('listing-images', p)).filter((u): u is string => !!u);
  const [index, setIndex] = useState(0);
  const count = urls.length;
  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  if (count === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-3xl bg-surface-2 text-muted">
        <ImageOff className="size-10" />
      </div>
    );
  }

  return (
    <div>
      <div
        className="group relative aspect-[4/3] overflow-hidden rounded-3xl bg-surface-2 ring-1 ring-line/60"
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label={`Photos of ${title}`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') go(-1);
          if (e.key === 'ArrowRight') go(1);
        }}
      >
        <img key={urls[index]} src={urls[index]} alt={`${title}, photo ${index + 1} of ${count}`} className="size-full object-contain animate-fade-in" />
        {count > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 shadow-soft opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              aria-label="Previous photo"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 shadow-soft opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              aria-label="Next photo"
            >
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
              {index + 1} / {count}
            </span>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto">
          {urls.map((u, i) => (
            <button
              key={u}
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
              className={cx(
                'size-20 shrink-0 overflow-hidden rounded-xl ring-2 transition',
                i === index ? 'ring-brand' : 'ring-transparent opacity-70 hover:opacity-100',
              )}
            >
              <img src={u} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Actions({ listing, isOwner }: { listing: Detail; isOwner: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: cart } = useCart();
  const { data: admin } = useAdminStatus();
  const [messageOpen, setMessageOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const inCart = cart?.some((c) => c.listing_id === listing.id);

  const add = useMutation({
    mutationFn: () => addToCart(listing.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.cart(user!.id) });
      toast.success('Added to your bag.');
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const remove = useMutation({
    mutationFn: () => deleteListing(listing),
    onSuccess: () => {
      toast.success('Listing deleted.');
      void queryClient.invalidateQueries();
      navigate('/selling');
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const requireLogin = () => navigate(`/login?next=${encodeURIComponent(`/listing/${listing.id}`)}`);

  if (isOwner) {
    return (
      <div className="flex flex-col gap-2">
        {listing.status === 'active' && (
          <ButtonLink to={`/listing/${listing.id}/edit`} size="lg" icon={<Pencil className="size-4" />}>
            Edit listing
          </ButtonLink>
        )}
        <Button variant="outline" size="lg" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
        <Modal
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title="Delete this listing?"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
                Delete listing
              </Button>
            </>
          }
        >
          <p className="text-muted">This can’t be undone. Buyers who saved it in their bag will see it as unavailable.</p>
        </Modal>
      </div>
    );
  }

  if (listing.status !== 'active') return null;

  return (
    <div className="flex flex-col gap-2">
      {inCart ? (
        <ButtonLink to="/cart" size="lg" variant="secondary" icon={<Check className="size-4" />}>
          In your bag · Checkout
        </ButtonLink>
      ) : (
        <Button
          size="lg"
          icon={<ShoppingBag className="size-4" />}
          loading={add.isPending}
          onClick={() => (user ? add.mutate() : requireLogin())}
        >
          Add to bag
        </Button>
      )}
      <Button
        variant="outline"
        size="lg"
        icon={<MessageCircle className="size-4" />}
        onClick={() => (user ? setMessageOpen(true) : requireLogin())}
      >
        Message seller
      </Button>
      {admin?.is_admin && admin.aal === 'aal2' && (
        <Button variant="ghost" size="sm" className="text-danger" icon={<ShieldX className="size-4" />} onClick={() => setRemoveOpen(true)}>
          Remove (moderator)
        </Button>
      )}
      <MessageSellerModal open={messageOpen} onClose={() => setMessageOpen(false)} listing={listing} />
      <RemoveListingModal open={removeOpen} onClose={() => setRemoveOpen(false)} listingId={listing.id} />
    </div>
  );
}

function MessageSellerModal({ open, onClose, listing }: { open: boolean; onClose: () => void; listing: Detail }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [body, setBody] = useState(`Hi! Is “${listing.title.slice(0, 60)}” still available?`);
  const send = useMutation({
    mutationFn: async () => {
      const conversationId = await startConversation(listing.id);
      await sendMessage(conversationId, body.trim());
      return conversationId;
    },
    onSuccess: (cid) => navigate(`/messages/${cid}`),
    onError: (e) => toast.error(friendlyError(e)),
  });
  const tooLong = body.length > MESSAGE_MAX;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Message ${listing.seller?.display_name ?? 'seller'}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={send.isPending} disabled={!body.trim() || tooLong} onClick={() => send.mutate()}>
            Send message
          </Button>
        </>
      }
    >
      <Field label="Your message" counter={{ value: body.length, max: MESSAGE_MAX }}>
        {(id) => <Textarea id={id} value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={MESSAGE_MAX + 100} />}
      </Field>
      <p className="mt-3 flex items-start gap-2 text-xs text-muted">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        Never share passwords, card details or verification codes in chat. Curio staff will never ask for them.
      </p>
    </Modal>
  );
}

export function RemoveListingModal({
  open,
  onClose,
  listingId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  listingId: string;
  onDone?: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: () => setListingStatus(listingId, 'remove', reason.trim() || undefined),
    onSuccess: () => {
      toast.success('Listing removed.');
      void queryClient.invalidateQueries();
      onClose();
      onDone?.();
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Remove listing"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={m.isPending} onClick={() => m.mutate()}>
            Remove
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-muted">The listing will be hidden from everyone except the seller. This action is logged.</p>
      <Field label="Reason (shown to the seller)" counter={{ value: reason.length, max: 500 }}>
        {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} />}
      </Field>
    </Modal>
  );
}

const REPORT_REASONS = {
  prohibited: 'Prohibited or illegal item',
  scam: 'Scam or fraud',
  counterfeit: 'Counterfeit',
  offensive: 'Offensive content',
  spam: 'Spam or duplicate',
  other: 'Something else',
} as const;

function ReportButton({ listingId }: { listingId: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<keyof typeof REPORT_REASONS>('scam');
  const [details, setDetails] = useState('');
  const m = useMutation({
    mutationFn: () => reportListing(listingId, reason, details.trim()),
    onSuccess: () => {
      toast.success('Thanks. Our moderators will take a look.');
      setOpen(false);
      setDetails('');
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
  return (
    <>
      <button onClick={() => setOpen(true)} className="mt-4 flex items-center gap-2 text-sm text-muted hover:text-danger">
        <Flag className="size-4" /> Report this listing
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Report listing"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={m.isPending} onClick={() => m.mutate()}>
              Submit report
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="What’s wrong?">
            {(id) => (
              <Select id={id} value={reason} onChange={(e) => setReason(e.target.value as keyof typeof REPORT_REASONS)}>
                {Object.entries(REPORT_REASONS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Details (optional)" counter={{ value: details.length, max: 1000 }}>
            {(id) => <Textarea id={id} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} rows={4} />}
          </Field>
        </div>
      </Modal>
    </>
  );
}

function MoreFromSeller({ sellerId, excludeId, sellerName }: { sellerId: string; excludeId: string; sellerName: string }) {
  const { data } = useQuery({
    queryKey: ['seller-more', sellerId],
    queryFn: () => searchListings({ seller: sellerId }, 0, 5),
  });
  const items = (data ?? []).filter((l) => l.id !== excludeId).slice(0, 4);
  if (items.length === 0) return null;
  return (
    <section className="mt-20">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-2xl font-bold">More from {sellerName}</h2>
        <Link to={`/u/${sellerId}`} className="text-sm font-semibold text-brand-ink hover:underline">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
        {items.map((l, i) => (
          <ListingCard key={l.id} listing={l} index={i} />
        ))}
      </div>
    </section>
  );
}
