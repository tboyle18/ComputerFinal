import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, PackageSearch, Pencil, ShoppingBag, Tag } from 'lucide-react';
import { getProfile, getSellerStats } from '../api/profiles';
import { searchListings } from '../api/listings';
import { useAuth } from '../auth/AuthProvider';
import { keys } from '../hooks/queries';
import { formatMonthYear, isUuid } from '../lib/format';
import { ListingCard, ListingGridSkeleton } from '../components/ListingCard';
import { Avatar, ButtonLink, EmptyState, PageLoader } from '../components/ui';
import { NotFound } from './NotFound';

export function PublicProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const valid = isUuid(id);
  const { data: profile, isPending } = useQuery({
    queryKey: keys.profile(id ?? ''),
    queryFn: () => getProfile(id!),
    enabled: valid,
  });
  const { data: stats } = useQuery({ queryKey: ['seller-stats', id], queryFn: () => getSellerStats(id!), enabled: valid });
  const { data: listings, isPending: listingsPending } = useQuery({
    queryKey: ['seller-listings', id],
    queryFn: () => searchListings({ seller: id }, 0, 48),
    enabled: valid,
  });

  if (!valid) return <NotFound />;
  if (isPending) return <PageLoader />;
  if (!profile) return <NotFound title="Profile not found" />;
  const isMe = user?.id === profile.id;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <section className="card hero-glow relative overflow-hidden p-6 sm:p-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Avatar name={profile.display_name} path={profile.avatar_path} size={96} className="ring-4 ring-surface" />
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-3xl font-extrabold">{profile.display_name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              {profile.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" /> {profile.location}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-4" /> Joined {formatMonthYear(profile.created_at)}
              </span>
            </div>
            {profile.bio && <p className="mt-4 max-w-2xl whitespace-pre-wrap break-words text-ink/85">{profile.bio}</p>}
          </div>
          <div className="flex gap-3 sm:flex-col sm:items-end">
            <div className="flex gap-3">
              <StatPill icon={<Tag className="size-4" />} label="Listed" value={stats?.active ?? 0} />
              <StatPill icon={<ShoppingBag className="size-4" />} label="Sold" value={stats?.sold ?? 0} />
            </div>
            {isMe && (
              <ButtonLink to="/account" variant="outline" size="sm" icon={<Pencil className="size-4" />}>
                Edit profile
              </ButtonLink>
            )}
          </div>
        </div>
      </section>

      <h2 className="mb-6 mt-12 text-2xl font-bold">{isMe ? 'Your active listings' : 'Active listings'}</h2>
      {listingsPending ? (
        <ListingGridSkeleton count={4} />
      ) : !listings?.length ? (
        <EmptyState icon={<PackageSearch className="size-7" />} title="No active listings" action={isMe ? <ButtonLink to="/sell">List an item</ButtonLink> : undefined}>
          {isMe ? 'Items you list will show up here.' : 'Check back later for new items.'}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((l, i) => (
            <ListingCard key={l.id} listing={l} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/80 px-4 py-2.5 text-center backdrop-blur">
      <p className="font-display text-xl font-extrabold">{value}</p>
      <p className="flex items-center justify-center gap-1 text-xs text-muted">
        {icon} {label}
      </p>
    </div>
  );
}
