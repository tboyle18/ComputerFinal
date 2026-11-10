import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, ImageOff, Pencil, Plus, ShieldX, Store, Trash2 } from 'lucide-react';
import { deleteListing, getMyListings, type ListingStatus } from '../api/listings';
import { useAuth } from '../auth/AuthProvider';
import { keys } from '../hooks/queries';
import { formatDate, formatPrice } from '../lib/format';
import { imageUrl } from '../lib/images';
import { friendlyError } from '../lib/errors';
import { useToast } from '../components/Toast';
import { Alert, Button, ButtonLink, EmptyState, Modal, SectionTitle, Spinner, cx } from '../components/ui';

const TABS: Array<{ key: ListingStatus; label: string }> = [
  { key: 'active', label: 'Active' },
  { key: 'sold', label: 'Sold' },
  { key: 'removed', label: 'Removed' },
];

export function Selling() {
  const { user } = useAuth();
  const [tab, setTab] = useState<ListingStatus>('active');
  const { data, isPending, isError, error } = useQuery({
    queryKey: [...keys.myListings(user!.id), tab],
    queryFn: () => getMyListings(user!.id, tab),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <SectionTitle
        title="My listings"
        subtitle="Manage what you’re selling."
        action={
          <ButtonLink to="/sell" icon={<Plus className="size-4" />}>
            New listing
          </ButtonLink>
        }
      />
      <div role="tablist" className="mb-6 inline-flex rounded-2xl bg-surface-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              'rounded-xl px-4 py-2 text-sm font-semibold transition',
              tab === t.key ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : isError ? (
        <Alert tone="danger">{friendlyError(error)}</Alert>
      ) : data.length === 0 ? (
        <EmptyState
          icon={<Store className="size-7" />}
          title={tab === 'active' ? 'Nothing for sale yet' : tab === 'sold' ? 'No sales yet' : 'Nothing removed'}
          action={tab === 'active' ? <ButtonLink to="/sell">List your first item</ButtonLink> : undefined}
        >
          {tab === 'active' ? 'Turn clutter into cash. It only takes a minute.' : undefined}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.map((l) => (
            <MyListingRow key={l.id} listing={l} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MyListingRow({ listing }: { listing: Awaited<ReturnType<typeof getMyListings>>[number] }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const del = useMutation({
    mutationFn: () => deleteListing(listing),
    onSuccess: () => {
      toast.success('Listing deleted.');
      setConfirm(false);
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
  const img = imageUrl('listing-images', listing.image_paths[0]);

  return (
    <li className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-surface-2">
          {img ? <img src={img} alt="" loading="lazy" className="size-full object-cover" /> : <ImageOff className="m-auto mt-7 size-5 text-muted" />}
        </div>
        <div className="min-w-0">
          <Link to={`/listing/${listing.id}`} className="line-clamp-1 font-semibold hover:text-brand-ink">
            {listing.title}
          </Link>
          <p className="mt-0.5 font-display font-bold">{formatPrice(listing.price_cents)}</p>
          <p className="text-xs text-muted">
            {listing.status === 'sold' && listing.sold_at ? `Sold ${formatDate(listing.sold_at)}` : `Listed ${formatDate(listing.created_at)}`}
          </p>
          {listing.status === 'removed' && (
            <p className="mt-1 flex items-center gap-1 text-xs text-danger">
              <ShieldX className="size-3.5" /> {listing.removed_reason ?? 'Removed by a moderator'}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <ButtonLink to={`/listing/${listing.id}`} variant="ghost" size="sm" icon={<Eye className="size-4" />}>
          View
        </ButtonLink>
        {listing.status === 'active' && (
          <ButtonLink to={`/listing/${listing.id}/edit`} variant="outline" size="sm" icon={<Pencil className="size-4" />}>
            Edit
          </ButtonLink>
        )}
        <Button variant="ghost" size="sm" className="text-danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirm(true)}>
          Delete
        </Button>
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete listing?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={del.isPending} onClick={() => del.mutate()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-muted">“{listing.title}” will be permanently deleted. Past orders keep their records.</p>
      </Modal>
    </li>
  );
}
