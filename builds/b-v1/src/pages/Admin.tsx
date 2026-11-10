import {
  CircleDollarSign,
  Crown,
  ExternalLink,
  LayoutDashboard,
  MessagesSquare,
  MoreHorizontal,
  Package,
  Receipt,
  Search,
  ShieldOff,
  Tag,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { PageContainer } from '../components/layout/Layout'
import { ListingImage } from '../components/listings/ListingImage'
import { Avatar } from '../components/ui/Avatar'
import { Dropdown, MenuItem, MenuSeparator } from '../components/ui/Dropdown'
import { Badge, EmptyState, Skeleton } from '../components/ui/Feedback'
import { Select } from '../components/ui/Field'
import { ConfirmDialog } from '../components/ui/Modal'
import { Tabs } from '../components/ui/Tabs'
import { useAuth } from '../context/AuthContext'
import { CATEGORIES, getCategory } from '../lib/categories'
import { removeListingImages } from '../lib/images'
import { supabase } from '../lib/supabase'
import { LISTING_CARD_SELECT, type AdminStats, type AdminUser, type ListingWithSeller, type Order, type SellerSummary } from '../lib/types'
import { cn, displayName, errorMessage, formatDate, formatMoney, formatPrice, sanitizeSearch, timeAgo } from '../lib/utils'

type Tab = 'overview' | 'users' | 'listings' | 'orders'
type AdminOrder = Order & { buyer: SellerSummary | null; items: { id: string }[] }

export default function Admin() {
  const [params, setParams] = useSearchParams()
  const tab = (['overview', 'users', 'listings', 'orders'].includes(params.get('tab') ?? '') ? params.get('tab') : 'overview') as Tab

  return (
    <PageContainer className="pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted uppercase">
            <LayoutDashboard className="size-3.5" /> Admin
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Marketplace dashboard</h1>
        </div>
        <Tabs
          value={tab}
          onChange={(t) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })}
          tabs={[
            { value: 'overview', label: 'Overview' },
            { value: 'users', label: 'Users' },
            { value: 'listings', label: 'Listings' },
            { value: 'orders', label: 'Orders' },
          ]}
        />
      </div>
      <div className="mt-8">
        {tab === 'overview' && <Overview onNavigate={(t) => setParams({ tab: t })} />}
        {tab === 'users' && <UsersTab />}
        {tab === 'listings' && <ListingsTab />}
        {tab === 'orders' && <OrdersTab />}
      </div>
    </PageContainer>
  )
}

/* ---------------------------------- Overview --------------------------------- */

function StatCard({ icon: Icon, label, value, sub, accent }: { icon: typeof Users; label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className={cn('rounded-3xl border p-5', accent ? 'border-transparent bg-ink text-canvas' : 'border-line bg-surface')}>
      <div className="flex items-center justify-between">
        <p className={cn('text-[13px] font-medium', accent ? 'text-canvas/70' : 'text-muted')}>{label}</p>
        <span className={cn('flex size-8 items-center justify-center rounded-xl', accent ? 'bg-accent text-accent-ink' : 'bg-surface-2')}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {sub && <p className={cn('mt-1 text-[13px]', accent ? 'text-canvas/60' : 'text-muted')}>{sub}</p>}
    </div>
  )
}

function Overview({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [recentListings, setRecentListings] = useState<ListingWithSeller[]>([])
  const [recentOrders, setRecentOrders] = useState<AdminOrder[]>([])
  const [byCategory, setByCategory] = useState<Record<string, number>>({})

  useEffect(() => {
    ;(async () => {
      const [s, l, o, cats] = await Promise.all([
        supabase.rpc('admin_stats'),
        supabase.from('listings').select(LISTING_CARD_SELECT).order('created_at', { ascending: false }).limit(6),
        supabase
          .from('orders')
          .select('*, buyer:profiles!orders_buyer_id_fkey(id, username, full_name, avatar_url), items:order_items(id)')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase.from('listings').select('category').eq('status', 'active'),
      ])
      if (s.error) toast.error(errorMessage(s.error))
      setStats(s.data as unknown as AdminStats)
      setRecentListings((l.data ?? []) as unknown as ListingWithSeller[])
      setRecentOrders((o.data ?? []) as unknown as AdminOrder[])
      const counts: Record<string, number> = {}
      for (const row of cats.data ?? []) counts[row.category] = (counts[row.category] ?? 0) + 1
      setByCategory(counts)
    })()
  }, [])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats ? (
          <>
            <StatCard icon={CircleDollarSign} label="Gross sales" value={formatPrice(stats.revenue)} sub={`${stats.orders} orders placed`} accent />
            <StatCard icon={Users} label="Users" value={stats.users.toLocaleString()} sub={`+${stats.new_users_7d} this week`} />
            <StatCard icon={Tag} label="Active listings" value={stats.active_listings.toLocaleString()} sub={`${stats.sold_listings} sold`} />
            <StatCard icon={MessagesSquare} label="Messages" value={stats.messages.toLocaleString()} sub="Across all conversations" />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-3xl" />)
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Latest listings" action={<button onClick={() => onNavigate('listings')} className="text-[13px] font-medium text-muted hover:text-ink">Manage →</button>}>
          <ul className="divide-y divide-line">
            {recentListings.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                <ListingImage path={l.images[0]} alt="" category={l.category} width={100} className="size-11 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <Link to={`/listing/${l.id}`} className="block truncate text-sm font-medium hover:underline">
                    {l.title}
                  </Link>
                  <p className="truncate text-[12px] text-muted">
                    by {displayName(l.seller)} · {timeAgo(l.created_at)}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{formatPrice(l.price)}</span>
              </li>
            ))}
            {recentListings.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">No listings yet</li>}
          </ul>
        </Panel>

        <Panel title="Active listings by category">
          <ul className="divide-y divide-line">
            {CATEGORIES.map((c) => (
              <li key={c.slug} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className="flex size-7 items-center justify-center rounded-lg" style={{ background: `${c.tint}22`, color: c.tint }}>
                  <c.icon className="size-3.5" />
                </span>
                <span className="flex-1">{c.name}</span>
                <span className="font-medium tabular-nums">{byCategory[c.slug] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Recent orders" action={<button onClick={() => onNavigate('orders')} className="text-[13px] font-medium text-muted hover:text-ink">View all →</button>}>
        <OrdersTable orders={recentOrders} />
      </Panel>
    </div>
  )
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-full border border-line bg-surface pr-4 pl-10 text-sm outline-none placeholder:text-muted focus:border-ink/40 focus:ring-4 focus:ring-ink/5"
      />
    </div>
  )
}

const th = 'px-5 py-3 text-left text-[12px] font-medium tracking-wide text-muted uppercase whitespace-nowrap'
const td = 'px-5 py-3.5 text-sm whitespace-nowrap'

/* ----------------------------------- Users ----------------------------------- */

function UsersTab() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [q, setQ] = useState('')
  const [toDelete, setToDelete] = useState<AdminUser | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_users')
    if (error) toast.error(errorMessage(error))
    setUsers(data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!users || !s) return users ?? []
    return users.filter((u) => [u.email, u.username, u.full_name].some((v) => v?.toLowerCase().includes(s)))
  }, [users, q])

  const setRole = async (u: AdminUser, role: 'admin' | 'user') => {
    const { error } = await supabase.rpc('admin_set_role', { p_user_id: u.id, p_role: role })
    if (error) return toast.error(errorMessage(error))
    toast.success(role === 'admin' ? `${displayName(u)} is now an admin` : `Admin access removed for ${displayName(u)}`)
    load()
  }

  const deleteUser = async () => {
    if (!toDelete) return
    const { error } = await supabase.rpc('admin_delete_user', { p_user_id: toDelete.id })
    if (error) {
      toast.error(errorMessage(error))
      throw error
    }
    toast.success(`${displayName(toDelete)} was removed`)
    setUsers((prev) => prev?.filter((u) => u.id !== toDelete.id) ?? null)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search by name, username or email" />
        <p className="text-sm text-muted">{users ? `${filtered.length} of ${users.length} users` : 'Loading…'}</p>
      </div>
      <div className="mt-4 overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="thin-scrollbar overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-surface-2/40">
              <tr>
                <th className={th}>User</th>
                <th className={th}>Email</th>
                <th className={th}>Role</th>
                <th className={cn(th, 'text-right')}>Listings</th>
                <th className={cn(th, 'text-right')}>Orders</th>
                <th className={th}>Joined</th>
                <th className={th}>Last sign-in</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!users
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="px-5 py-3">
                        <Skeleton className="h-8" />
                      </td>
                    </tr>
                  ))
                : filtered.map((u) => (
                    <tr key={u.id} className="transition-colors hover:bg-surface-2/40">
                      <td className={td}>
                        <Link to={`/u/${u.username}`} className="flex items-center gap-3">
                          <Avatar src={u.avatar_url} name={displayName(u)} seed={u.id} size={34} />
                          <div>
                            <p className="font-medium">
                              {displayName(u)} {u.id === me?.id && <span className="text-muted">(you)</span>}
                            </p>
                            <p className="text-[12px] text-muted">@{u.username}</p>
                          </div>
                        </Link>
                      </td>
                      <td className={cn(td, 'text-ink-2')}>{u.email}</td>
                      <td className={td}>{u.role === 'admin' ? <Badge tone="accent">Admin</Badge> : <Badge>User</Badge>}</td>
                      <td className={cn(td, 'text-right tabular-nums')}>{u.listing_count}</td>
                      <td className={cn(td, 'text-right tabular-nums')}>{u.order_count}</td>
                      <td className={cn(td, 'text-muted')}>{formatDate(u.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td className={cn(td, 'text-muted')}>{u.last_sign_in_at ? timeAgo(u.last_sign_in_at) : 'Never'}</td>
                      <td className={cn(td, 'text-right')}>
                        <Dropdown
                          trigger={({ toggle }) => (
                            <button onClick={toggle} className="rounded-full p-2 text-muted transition hover:bg-surface-2 hover:text-ink" aria-label={`Actions for ${u.username}`}>
                              <MoreHorizontal className="size-4" />
                            </button>
                          )}
                        >
                          {(close) => (
                            <>
                              <MenuItem to={`/u/${u.username}`} onClick={close}>
                                <UserRound /> View profile
                              </MenuItem>
                              {u.id !== me?.id && (
                                <>
                                  {u.role === 'admin' ? (
                                    <MenuItem onClick={() => { close(); setRole(u, 'user') }}>
                                      <ShieldOff /> Remove admin
                                    </MenuItem>
                                  ) : (
                                    <MenuItem onClick={() => { close(); setRole(u, 'admin') }}>
                                      <Crown /> Make admin
                                    </MenuItem>
                                  )}
                                  <MenuSeparator />
                                  <MenuItem danger onClick={() => { close(); setToDelete(u) }}>
                                    <Trash2 /> Delete user
                                  </MenuItem>
                                </>
                              )}
                            </>
                          )}
                        </Dropdown>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {users && filtered.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted">No users match “{q}”.</p>}
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={deleteUser}
        title={`Delete ${toDelete ? displayName(toDelete) : 'user'}?`}
        description={
          <>
            This permanently deletes their account, profile, {toDelete?.listing_count ?? 0} listing(s), cart and conversations. Past orders are kept
            for record-keeping. This can’t be undone.
          </>
        }
        confirmLabel="Delete user"
        confirmText={toDelete?.username}
      />
    </div>
  )
}

/* --------------------------------- Listings ---------------------------------- */

function ListingsTab() {
  const [rows, setRows] = useState<ListingWithSeller[] | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'sold'>('all')
  const [toRemove, setToRemove] = useState<ListingWithSeller | null>(null)

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      let query = supabase.from('listings').select(LISTING_CARD_SELECT).order('created_at', { ascending: false }).limit(200)
      if (status !== 'all') query = query.eq('status', status)
      const s = sanitizeSearch(q)
      if (s) query = query.ilike('title', `%${s}%`)
      const { data } = await query
      if (!cancelled) setRows((data ?? []) as unknown as ListingWithSeller[])
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q, status])

  const remove = async () => {
    if (!toRemove) return
    const { error } = await supabase.from('listings').delete().eq('id', toRemove.id)
    if (error) {
      toast.error(errorMessage(error))
      throw error
    }
    await removeListingImages(toRemove.images)
    toast.success('Listing removed')
    setRows((prev) => prev?.filter((r) => r.id !== toRemove.id) ?? null)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search listing titles" />
        <div className="w-40">
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-10 rounded-full text-sm" aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="sold">Sold</option>
          </Select>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="thin-scrollbar overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-surface-2/40">
              <tr>
                <th className={th}>Listing</th>
                <th className={th}>Seller</th>
                <th className={th}>Category</th>
                <th className={cn(th, 'text-right')}>Price</th>
                <th className={th}>Status</th>
                <th className={th}>Listed</th>
                <th className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {!rows
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-5 py-3">
                        <Skeleton className="h-10" />
                      </td>
                    </tr>
                  ))
                : rows.map((l) => (
                    <tr key={l.id} className="transition-colors hover:bg-surface-2/40">
                      <td className={td}>
                        <Link to={`/listing/${l.id}`} className="flex max-w-xs items-center gap-3">
                          <ListingImage path={l.images[0]} alt="" category={l.category} width={100} className="size-11 shrink-0 rounded-xl" />
                          <span className="truncate font-medium hover:underline">{l.title}</span>
                        </Link>
                      </td>
                      <td className={td}>
                        {l.seller ? (
                          <Link to={`/u/${l.seller.username}`} className="flex items-center gap-2 text-ink-2 hover:text-ink">
                            <Avatar src={l.seller.avatar_url} name={displayName(l.seller)} seed={l.seller.id} size={22} />
                            {displayName(l.seller)}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={cn(td, 'text-ink-2')}>{getCategory(l.category).name}</td>
                      <td className={cn(td, 'text-right font-medium tabular-nums')}>{formatPrice(l.price)}</td>
                      <td className={td}>{l.status === 'sold' ? <Badge tone="ink">Sold</Badge> : <Badge tone="success">Active</Badge>}</td>
                      <td className={cn(td, 'text-muted')}>{timeAgo(l.created_at)}</td>
                      <td className={cn(td, 'text-right')}>
                        <div className="flex justify-end gap-1">
                          <Link to={`/listing/${l.id}`} className="rounded-full p-2 text-muted transition hover:bg-surface-2 hover:text-ink" aria-label="View listing">
                            <ExternalLink className="size-4" />
                          </Link>
                          <button onClick={() => setToRemove(l)} className="rounded-full p-2 text-muted transition hover:bg-danger/10 hover:text-danger" aria-label="Remove listing">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {rows && rows.length === 0 && (
          <div className="p-6">
            <EmptyState icon={Package} title="No listings found" className="border-0 bg-transparent py-8" />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toRemove)}
        onClose={() => setToRemove(null)}
        onConfirm={remove}
        title="Remove this listing?"
        description={`“${toRemove?.title}” by ${displayName(toRemove?.seller)} will be permanently deleted along with its photos.`}
        confirmLabel="Remove listing"
      />
    </div>
  )
}

/* ---------------------------------- Orders ----------------------------------- */

function OrdersTab() {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null)
  useEffect(() => {
    supabase
      .from('orders')
      .select('*, buyer:profiles!orders_buyer_id_fkey(id, username, full_name, avatar_url), items:order_items(id)')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setOrders((data ?? []) as unknown as AdminOrder[]))
  }, [])

  if (!orders) return <Skeleton className="h-64 rounded-3xl" />
  if (orders.length === 0) return <EmptyState icon={Receipt} title="No orders yet" description="Orders will appear here as soon as buyers check out." />

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface">
      <OrdersTable orders={orders} />
    </div>
  )
}

function OrdersTable({ orders }: { orders: AdminOrder[] }) {
  if (orders.length === 0) return <p className="px-5 py-8 text-center text-sm text-muted">No orders yet</p>
  return (
    <div className="thin-scrollbar overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-line bg-surface-2/40">
          <tr>
            <th className={th}>Order</th>
            <th className={th}>Buyer</th>
            <th className={cn(th, 'text-right')}>Items</th>
            <th className={cn(th, 'text-right')}>Total</th>
            <th className={th}>Ship to</th>
            <th className={th}>Placed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {orders.map((o) => (
            <tr key={o.id} className="transition-colors hover:bg-surface-2/40">
              <td className={cn(td, 'font-mono text-[13px]')}>
                <Link to={`/orders/${o.id}`} className="hover:underline">
                  {o.order_number}
                </Link>
              </td>
              <td className={td}>
                <div className="flex items-center gap-2">
                  <Avatar src={o.buyer?.avatar_url} name={displayName(o.buyer)} seed={o.buyer?.id} size={22} />
                  {displayName(o.buyer)}
                </div>
              </td>
              <td className={cn(td, 'text-right tabular-nums')}>{o.items.length}</td>
              <td className={cn(td, 'text-right font-medium tabular-nums')}>{formatMoney(o.total)}</td>
              <td className={cn(td, 'text-muted')}>
                {o.shipping_city}, {o.shipping_country}
              </td>
              <td className={cn(td, 'text-muted')}>{timeAgo(o.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
