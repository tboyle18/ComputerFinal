import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Package,
  Plus,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  User as UserIcon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { useAdminStatus, useCart, useMessageNotifications, useUnreadCount, keys } from '../hooks/queries';
import { getProfile } from '../api/profiles';
import { Logo, LogoMark } from './Logo';
import { Avatar, ButtonLink, cx } from './ui';
import { MfaChallenge } from '../pages/auth/MfaChallenge';
import { useToast } from './Toast';

export function Layout() {
  const { mfaRequired } = useAuth();
  const { pathname } = useLocation();
  useMessageNotifications();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2 focus:shadow-lift"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="flex-1">
        {/* SECURITY: users with 2FA enrolled must verify before seeing anything
            private. The database enforces this too (restrictive RLS). */}
        {mfaRequired ? <MfaChallenge /> : <Outlet />}
      </main>
      <Footer />
    </div>
  );
}

function SearchBox({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  useEffect(() => setQ(params.get('q') ?? ''), [params]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams();
    const term = q.trim().slice(0, 100);
    if (term) next.set('q', term);
    navigate({ pathname: '/', search: next.toString() });
  };

  return (
    <form onSubmit={submit} role="search" className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxLength={100}
        autoFocus={autoFocus}
        placeholder="Search for anything"
        aria-label="Search listings"
        className="h-10 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-sm text-ink placeholder:text-muted/80 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
      />
    </form>
  );
}

function IconLink({ to, label, count, children }: { to: string; label: string; count?: number; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      aria-label={count ? `${label} (${count})` : label}
      className={({ isActive }) =>
        cx(
          'relative inline-flex size-10 items-center justify-center rounded-full transition-colors hover:bg-surface-2',
          isActive ? 'text-brand' : 'text-ink',
        )
      }
    >
      {children}
      {!!count && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white ring-2 ring-bg">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </NavLink>
  );
}

function Navbar() {
  const { user, loading } = useAuth();
  const { data: cart } = useCart();
  const { data: unread } = useUnreadCount();
  const { pathname } = useLocation();
  const showSearch = pathname !== '/';

  return (
    <header className="glass sticky top-0 z-40 border-b border-line/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Logo className="shrink-0" />
        <div className="hidden flex-1 justify-center md:flex">
          {showSearch && <SearchBox className="w-full max-w-md" />}
        </div>
        <nav className="ml-auto flex items-center gap-1 sm:gap-1.5" aria-label="Main">
          {loading ? null : user ? (
            <>
              <ButtonLink to="/sell" size="sm" icon={<Plus className="size-4" />} className="mr-1 hidden sm:inline-flex">
                Sell
              </ButtonLink>
              <IconLink to="/messages" label="Messages" count={unread}>
                <MessageCircle className="size-5" />
              </IconLink>
              <IconLink to="/cart" label="Cart" count={cart?.length}>
                <ShoppingBag className="size-5" />
              </IconLink>
              <UserMenu />
            </>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm">
                Log in
              </ButtonLink>
              <ButtonLink to="/signup" size="sm">
                Sign up
              </ButtonLink>
            </>
          )}
        </nav>
      </div>
      {showSearch && (
        <div className="px-4 pb-3 md:hidden">
          <SearchBox />
        </div>
      )}
    </header>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const { data: profile } = useQuery({
    queryKey: keys.profile(user!.id),
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
  });
  const { data: admin } = useAdminStatus();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const name = profile?.display_name ?? 'Account';
  const items = [
    { to: `/u/${user!.id}`, label: 'My profile', icon: UserIcon },
    { to: '/selling', label: 'My listings', icon: Store },
    { to: '/orders', label: 'Orders', icon: Package },
    { to: '/sales', label: 'Sales', icon: Receipt },
    { to: '/account', label: 'Settings', icon: Settings },
    ...(admin?.is_admin ? [{ to: '/admin', label: 'Admin', icon: LayoutDashboard }] : []),
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="ml-1 flex items-center rounded-full ring-offset-2 ring-offset-bg transition hover:ring-2 hover:ring-line"
      >
        <Avatar name={name} path={profile?.avatar_path} size={36} />
        <span className="sr-only">Open account menu</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-lift animate-pop"
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar name={name} path={profile?.avatar_path} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link
            to="/sell"
            role="menuitem"
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-brand-ink hover:bg-brand-soft sm:hidden"
          >
            <Plus className="size-4" /> Sell an item
          </Link>
          {items.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} role="menuitem" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-surface-2">
              <Icon className="size-4 text-muted" /> {label}
            </Link>
          ))}
          <div className="my-1 h-px bg-line" />
          <button
            role="menuitem"
            onClick={async () => {
              await signOut('local');
              toast.success('You’ve been logged out.');
              navigate('/');
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-2"
          >
            <LogOut className="size-4 text-muted" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5 font-display text-xl font-extrabold">
            <LogoMark /> curio
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted">
            A friendly marketplace for pre-loved and new things. Find something worth keeping.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
            <ShieldCheck className="size-3.5" /> Secure by design
          </p>
        </div>
        <FooterCol
          title="Marketplace"
          links={[
            ['/', 'Browse'],
            ['/sell', 'Sell an item'],
            ['/selling', 'My listings'],
          ]}
        />
        <FooterCol
          title="Account"
          links={[
            ['/orders', 'Orders'],
            ['/messages', 'Messages'],
            ['/account', 'Settings & security'],
          ]}
        />
        <div>
          <h3 className="text-sm font-semibold">Stay safe</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Keep payments and chats on Curio.</li>
            <li>We’ll never ask for your password.</li>
            <li>
              <a className="hover:text-ink" href="/.well-known/security.txt">
                Report a vulnerability
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted sm:px-6">
          <p>© {new Date().getFullYear()} Curio Marketplace</p>
          <p>Demo build: payments are simulated and no card details are ever collected.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-muted">
        {links.map(([to, label]) => (
          <li key={to}>
            <Link to={to} className="hover:text-ink">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
