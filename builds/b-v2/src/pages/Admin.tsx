import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DollarSign,
  ExternalLink,
  Flag,
  LayoutDashboard,
  Lock,
  Package,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldX,
  Trash2,
  Users,
} from 'lucide-react';
import {
  adminListings,
  getAdminStats,
  getAuditLog,
  listReports,
  listUsers,
  moderateUser,
  resolveReport,
  setListingStatus,
  type AdminUser,
} from '../api/admin';
import type { ListingStatus } from '../api/listings';
import { useAdminStatus } from '../hooks/queries';
import { useAuth } from '../auth/AuthProvider';
import { formatDate, formatDateTime, formatPrice, timeAgo } from '../lib/format';
import { imageUrl } from '../lib/images';
import { friendlyError } from '../lib/errors';
import { useToast } from '../components/Toast';
import { Alert, Avatar, Badge, Button, ButtonLink, EmptyState, Field, Input, Modal, PageLoader, Select, Spinner, Textarea, cx } from '../components/ui';
import { NotFound } from './NotFound';
import { RemoveListingModal } from './ListingDetail';

type Tab = 'overview' | 'users' | 'listings' | 'reports' | 'audit';
const TABS: Array<{ key: Tab; label: string; icon: typeof Users }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'listings', label: 'Listings', icon: Package },
  { key: 'reports', label: 'Reports', icon: Flag },
  { key: 'audit', label: 'Audit log', icon: ClipboardList },
];

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function Admin() {
  const { data: status, isPending } = useAdminStatus();
  const [tab, setTab] = useState<Tab>('overview');

  if (isPending) return <PageLoader />;
  // Non-admins see a plain 404: don't advertise that an admin area exists.
  if (!status?.is_admin) return <NotFound />;
  if (status.aal !== 'aal2') {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <div className="card p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-warning-soft text-warning">
            <Lock className="size-7" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Two-factor authentication required</h1>
          <p className="mt-2 text-muted">
            Admin tools are only available on sessions verified with an authenticator app. Set one up in your security settings.
          </p>
          <ButtonLink to="/account" className="mt-6">
            Open security settings
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-ink">
            <ShieldCheck className="size-4" /> Admin · 2FA verified
          </p>
          <h1 className="mt-1 text-3xl font-extrabold">Moderation dashboard</h1>
        </div>
      </div>
      <div role="tablist" className="scrollbar-none mb-8 flex gap-1 overflow-x-auto rounded-2xl bg-surface-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',
              tab === t.key ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink',
            )}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview onNavigate={setTab} />}
      {tab === 'users' && <UsersTab />}
      {tab === 'listings' && <ListingsTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}

/* -------------------------------------------------------------- Overview --- */
function Overview({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const { data, isPending, isError, error } = useQuery({ queryKey: ['admin', 'stats'], queryFn: getAdminStats });
  if (isPending) return <Spinner />;
  if (isError) return <Alert tone="danger">{friendlyError(error)}</Alert>;
  const cards = [
    { label: 'Users', value: data.users, sub: `+${data.users_7d} this week`, icon: Users, tab: 'users' as Tab },
    { label: 'Active listings', value: data.active_listings, sub: `${data.sold_listings} sold`, icon: Package, tab: 'listings' as Tab },
    { label: 'Open reports', value: data.open_reports, sub: 'Needs review', icon: Flag, tab: 'reports' as Tab, alert: data.open_reports > 0 },
    { label: 'Volume (simulated)', value: formatPrice(data.gmv_cents, { round: true }), sub: `${data.orders} orders`, icon: DollarSign },
    { label: 'Suspended users', value: data.suspended_users, sub: 'Blocked from writing', icon: Ban, tab: 'users' as Tab },
    { label: 'Removed listings', value: data.removed_listings, sub: 'Hidden by moderators', icon: ShieldX, tab: 'listings' as Tab },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <button
          key={c.label}
          disabled={!c.tab}
          onClick={() => c.tab && onNavigate(c.tab)}
          className="card p-6 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-lift"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted">{c.label}</p>
            <span className={cx('flex size-9 items-center justify-center rounded-xl', c.alert ? 'bg-accent-soft text-accent' : 'bg-brand-soft text-brand-ink')}>
              <c.icon className="size-4" />
            </span>
          </div>
          <p className="mt-3 font-display text-3xl font-extrabold">{c.value}</p>
          <p className="mt-1 text-xs text-muted">{c.sub}</p>
        </button>
      ))}
    </div>
  );
}

function Pager({ page, setPage, hasMore }: { page: number; setPage: (p: number) => void; hasMore: boolean }) {
  return (
    <div className="mt-4 flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page">
        <ChevronLeft className="size-4" />
      </Button>
      <span className="text-sm text-muted">Page {page + 1}</span>
      <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage(page + 1)} aria-label="Next page">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={100} className="pl-10" />
    </div>
  );
}

/* ----------------------------------------------------------------- Users --- */
function UsersTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const q = useDebounced(search);
  useEffect(() => setPage(0), [q]);
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin', 'users', q, page],
    queryFn: () => listUsers(q, page),
    placeholderData: keepPreviousData,
  });
  const [target, setTarget] = useState<{ user: AdminUser; action: 'suspend' | 'unsuspend' | 'delete' } | null>(null);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or user ID" />
        {data?.[0] && <p className="text-sm text-muted">{Number(data[0].total_count).toLocaleString()} users</p>}
      </div>
      {isError ? (
        <Alert tone="danger">{friendlyError(error)}</Alert>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">User</th>
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">Joined</th>
                <th className="px-5 py-3 font-semibold">Last sign-in</th>
                <th className="px-5 py-3 font-semibold">Listings</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <Spinner />
                  </td>
                </tr>
              ) : (
                data?.map((u) => (
                  <tr key={u.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/40">
                    <td className="px-5 py-3">
                      <Link to={`/u/${u.id}`} className="flex items-center gap-2.5 font-medium hover:text-brand-ink">
                        <Avatar name={u.display_name} size={28} />
                        <span className="max-w-40 truncate">{u.display_name}</span>
                      </Link>
                    </td>
                    <td className="max-w-56 truncate px-5 py-3 text-muted">{u.email}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted">{formatDate(u.created_at)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted">{u.last_sign_in_at ? timeAgo(u.last_sign_in_at) : 'Never'}</td>
                    <td className="px-5 py-3">{Number(u.active_listings)}</td>
                    <td className="px-5 py-3">
                      {u.is_admin ? <Badge tone="brand">Admin</Badge> : u.suspended_at ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>}
                    </td>
                    <td className="px-5 py-3">
                      {!u.is_admin && (
                        <div className="flex justify-end gap-1">
                          {u.suspended_at ? (
                            <Button variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} onClick={() => setTarget({ user: u, action: 'unsuspend' })}>
                              Restore
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" icon={<Ban className="size-4" />} onClick={() => setTarget({ user: u, action: 'suspend' })}>
                              Suspend
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="text-danger" icon={<Trash2 className="size-4" />} onClick={() => setTarget({ user: u, action: 'delete' })}>
                            Delete
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} setPage={setPage} hasMore={(data?.length ?? 0) === 25} />
      {target && <ModerateUserModal target={target} onClose={() => setTarget(null)} />}
    </div>
  );
}

function ModerateUserModal({
  target,
  onClose,
}: {
  target: { user: AdminUser; action: 'suspend' | 'unsuspend' | 'delete' };
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const { user, action } = target;
  const m = useMutation({
    mutationFn: () => moderateUser(action, user.id, reason.trim() || undefined),
    onSuccess: () => {
      toast.success(action === 'delete' ? 'User deleted.' : action === 'suspend' ? 'User suspended.' : 'User restored.');
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      onClose();
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
  const copy = {
    suspend: { title: `Suspend ${user.display_name}?`, body: 'They’ll be signed out, unable to sign in, and their listings will be hidden. Reversible.', cta: 'Suspend user' },
    unsuspend: { title: `Restore ${user.display_name}?`, body: 'They’ll be able to sign in and their listings will be visible again.', cta: 'Restore user' },
    delete: { title: `Delete ${user.display_name}?`, body: 'Permanently deletes their account, profile, listings, photos and messages. This cannot be undone.', cta: 'Delete permanently' },
  }[action];
  const needsTyping = action === 'delete';

  return (
    <Modal
      open
      onClose={onClose}
      title={copy.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={action === 'unsuspend' ? 'primary' : 'danger'}
            loading={m.isPending}
            disabled={needsTyping && typed !== 'DELETE'}
            onClick={() => m.mutate()}
          >
            {copy.cta}
          </Button>
        </>
      }
    >
      <p className="text-muted">{copy.body}</p>
      <p className="mt-2 text-xs text-muted">This action is recorded in the audit log.</p>
      {action !== 'unsuspend' && (
        <Field label="Reason (internal)" className="mt-4" counter={{ value: reason.length, max: 500 }}>
          {(id) => <Textarea id={id} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      )}
      {needsTyping && (
        <Field label='Type "DELETE" to confirm' className="mt-4">
          {(id) => <Input id={id} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />}
        </Field>
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------- Listings --- */
function ListingsTab() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ListingStatus>('active');
  const [page, setPage] = useState(0);
  const q = useDebounced(search);
  useEffect(() => setPage(0), [q, status]);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [removeId, setRemoveId] = useState<string | null>(null);
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin', 'listings', q, status, page],
    queryFn: () => adminListings(q, status, page),
    placeholderData: keepPreviousData,
  });
  const restore = useMutation({
    mutationFn: (id: string) => setListingStatus(id, 'restore'),
    onSuccess: () => {
      toast.success('Listing restored.');
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search listings" />
        <Select value={status} onChange={(e) => setStatus(e.target.value as ListingStatus)} className="w-auto" aria-label="Status">
          <option value="active">Active</option>
          <option value="removed">Removed</option>
          <option value="sold">Sold</option>
        </Select>
      </div>
      {isError ? (
        <Alert tone="danger">{friendlyError(error)}</Alert>
      ) : isPending ? (
        <Spinner />
      ) : data.length === 0 ? (
        <EmptyState icon={<Package className="size-7" />} title="No listings found" />
      ) : (
        <ul className="space-y-2">
          {data.map((l) => {
            const img = imageUrl('listing-images', l.image_paths[0]);
            return (
              <li key={l.id} className="card flex flex-wrap items-center gap-4 p-3">
                <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">{img && <img src={img} alt="" loading="lazy" className="size-full object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <Link to={`/listing/${l.id}`} className="line-clamp-1 font-medium hover:text-brand-ink">
                    {l.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {formatPrice(l.price_cents)} · by{' '}
                    <Link to={`/u/${l.seller_id}`} className="hover:underline">
                      {l.seller?.display_name ?? 'unknown'}
                    </Link>{' '}
                    · {timeAgo(l.created_at)}
                  </p>
                  {l.removed_reason && <p className="mt-0.5 text-xs text-danger">Reason: {l.removed_reason}</p>}
                </div>
                <div className="flex gap-1">
                  <ButtonLink to={`/listing/${l.id}`} variant="ghost" size="sm" icon={<ExternalLink className="size-4" />}>
                    View
                  </ButtonLink>
                  {l.status === 'active' && (
                    <Button variant="ghost" size="sm" className="text-danger" icon={<ShieldX className="size-4" />} onClick={() => setRemoveId(l.id)}>
                      Remove
                    </Button>
                  )}
                  {l.status === 'removed' && (
                    <Button variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} loading={restore.isPending && restore.variables === l.id} onClick={() => restore.mutate(l.id)}>
                      Restore
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={page} setPage={setPage} hasMore={(data?.length ?? 0) === 25} />
      {removeId && <RemoveListingModal open onClose={() => setRemoveId(null)} listingId={removeId} />}
    </div>
  );
}

/* --------------------------------------------------------------- Reports --- */
const REASON_LABEL: Record<string, string> = {
  prohibited: 'Prohibited item',
  scam: 'Scam / fraud',
  counterfeit: 'Counterfeit',
  offensive: 'Offensive',
  spam: 'Spam',
  other: 'Other',
};

function ReportsTab() {
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [removeId, setRemoveId] = useState<string | null>(null);
  const { data, isPending, isError, error } = useQuery({ queryKey: ['admin', 'reports', status], queryFn: () => listReports(status) });
  const resolve = useMutation({
    mutationFn: resolveReport,
    onSuccess: () => {
      toast.success('Report resolved.');
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  return (
    <div>
      <div className="mb-4 inline-flex rounded-xl bg-surface-2 p-1">
        {(['open', 'resolved'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cx('rounded-lg px-3 py-1.5 text-sm font-semibold capitalize', status === s ? 'bg-surface shadow-soft' : 'text-muted')}
          >
            {s}
          </button>
        ))}
      </div>
      {isError ? (
        <Alert tone="danger">{friendlyError(error)}</Alert>
      ) : isPending ? (
        <Spinner />
      ) : data.length === 0 ? (
        <EmptyState icon={<CheckCircle2 className="size-7" />} title={status === 'open' ? 'All clear' : 'No resolved reports'}>
          {status === 'open' ? 'No reports waiting for review.' : undefined}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.map((r) => (
            <li key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="danger">{REASON_LABEL[r.reason] ?? r.reason}</Badge>
                    {r.listing && <Badge>{r.listing.status}</Badge>}
                    <span className="text-xs text-muted">{formatDateTime(r.created_at)}</span>
                  </div>
                  {r.listing ? (
                    <Link to={`/listing/${r.listing.id}`} className="mt-2 block font-semibold hover:text-brand-ink">
                      {r.listing.title}
                    </Link>
                  ) : (
                    <p className="mt-2 font-semibold text-muted">Listing deleted</p>
                  )}
                  {r.details && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink/80">“{r.details}”</p>}
                  <p className="mt-2 text-xs text-muted">Reported by {r.reporter?.display_name ?? 'a deleted user'}</p>
                </div>
                {r.status === 'open' && (
                  <div className="flex gap-2">
                    {r.listing?.status === 'active' && (
                      <Button variant="danger" size="sm" icon={<ShieldX className="size-4" />} onClick={() => setRemoveId(r.listing!.id)}>
                        Remove listing
                      </Button>
                    )}
                    <Button variant="outline" size="sm" icon={<CheckCircle2 className="size-4" />} loading={resolve.isPending && resolve.variables === r.id} onClick={() => resolve.mutate(r.id)}>
                      Resolve
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {removeId && <RemoveListingModal open onClose={() => setRemoveId(null)} listingId={removeId} />}
    </div>
  );
}

/* ----------------------------------------------------------------- Audit --- */
function AuditTab() {
  const { user } = useAuth();
  const { data, isPending, isError, error } = useQuery({ queryKey: ['admin', 'audit'], queryFn: getAuditLog });
  if (isPending) return <Spinner />;
  if (isError) return <Alert tone="danger">{friendlyError(error)}</Alert>;
  if (data.length === 0) return <EmptyState icon={<ClipboardList className="size-7" />} title="No admin actions yet" />;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-5 py-3 font-semibold">When</th>
            <th className="px-5 py-3 font-semibold">Admin</th>
            <th className="px-5 py-3 font-semibold">Action</th>
            <th className="px-5 py-3 font-semibold">Target</th>
            <th className="px-5 py-3 font-semibold">Details</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => {
            const details = (r.details ?? {}) as Record<string, unknown>;
            const summary = [details.title, details.display_name, details.reason].filter((x) => typeof x === 'string' && x).join(' · ');
            return (
              <tr key={r.id} className="border-b border-line/60 last:border-0">
                <td className="whitespace-nowrap px-5 py-3 text-muted">{formatDateTime(r.created_at)}</td>
                <td className="px-5 py-3">{r.admin_id === user?.id ? 'You' : r.admin_name}</td>
                <td className="px-5 py-3">
                  <code className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs">{r.action}</code>
                </td>
                <td className="px-5 py-3 font-mono text-xs text-muted">
                  {r.target_type}:{r.target_id.slice(0, 8)}
                </td>
                <td className="max-w-72 truncate px-5 py-3 text-muted">{summary || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
