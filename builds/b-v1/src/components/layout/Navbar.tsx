import {
  Heart,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Package,
  Plus,
  Settings,
  ShoppingBag,
  Store,
  User,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { useInbox } from '../../context/InboxContext'
import { cn, displayName } from '../../lib/utils'
import { Avatar } from '../ui/Avatar'
import { ButtonLink } from '../ui/Button'
import { Dropdown, MenuItem, MenuSeparator } from '../ui/Dropdown'
import { Logo } from '../ui/Logo'
import { SearchBar } from './SearchBar'
import { ThemeSwitch, ThemeToggleButton } from './ThemeSwitch'

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink ring-2 ring-canvas tabular-nums">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function IconLink({ to, label, count = 0, children, className }: { to: string; label: string; count?: number; children: ReactNode; className?: string }) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      title={label}
      className={({ isActive }) =>
        cn(
          'relative flex size-10 items-center justify-center rounded-full text-ink-2 transition hover:bg-surface-2 hover:text-ink [&_svg]:size-[19px]',
          isActive && 'bg-surface-2 text-ink',
          className,
        )
      }
    >
      {children}
      <CountBadge count={count} />
    </NavLink>
  )
}

function UserMenu() {
  const { user, profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const name = displayName(profile)

  return (
    <Dropdown
      trigger={({ toggle, open }) => (
        <button
          onClick={toggle}
          className={cn('ml-1 rounded-full ring-offset-2 ring-offset-canvas transition hover:ring-2 hover:ring-line-strong', open && 'ring-2 ring-ink')}
          aria-label="Account menu"
          aria-expanded={open}
        >
          <Avatar src={profile?.avatar_url} name={name} seed={profile?.id} size={36} />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="flex items-center gap-3 px-3 pt-2 pb-3">
            <Avatar src={profile?.avatar_url} name={name} seed={profile?.id} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
          </div>
          <MenuSeparator />
          <MenuItem to={profile ? `/u/${profile.username}` : '/settings'} onClick={close}>
            <User /> Your profile
          </MenuItem>
          <MenuItem to="/orders" onClick={close}>
            <Package /> Orders & sales
          </MenuItem>
          <MenuItem to="/saved" onClick={close}>
            <Heart /> Saved items
          </MenuItem>
          <MenuItem to="/sell" onClick={close}>
            <Store /> Sell an item
          </MenuItem>
          <MenuItem to="/settings" onClick={close}>
            <Settings /> Settings
          </MenuItem>
          {isAdmin && (
            <>
              <MenuSeparator />
              <MenuItem to="/admin" onClick={close}>
                <LayoutDashboard /> Admin dashboard
              </MenuItem>
            </>
          )}
          <MenuSeparator />
          <div className="flex items-center justify-between gap-3 px-3 py-1.5">
            <span className="text-sm text-ink-2">Theme</span>
            <ThemeSwitch />
          </div>
          <MenuSeparator />
          <MenuItem
            onClick={async () => {
              close()
              navigate('/')
              await signOut()
              toast.success('Signed out. See you soon!')
            }}
          >
            <LogOut /> Sign out
          </MenuItem>
        </>
      )}
    </Dropdown>
  )
}

export function Navbar() {
  const { user, loading } = useAuth()
  const { count } = useCart()
  const { unread } = useInbox()

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:gap-6 lg:px-8">
        <Logo />
        <SearchBar className="mx-auto hidden max-w-xl md:block" />
        <nav className="ml-auto flex items-center gap-0.5 md:ml-0">
          {loading ? (
            <div className="skeleton size-9 rounded-full" />
          ) : user ? (
            <>
              <ButtonLink to="/sell" variant="accent" size="sm" className="mr-2 hidden h-9 px-4 sm:inline-flex">
                <Plus className="size-4" strokeWidth={2.5} /> Sell
              </ButtonLink>
              <IconLink to="/messages" label="Messages" count={unread} className="hidden md:flex">
                <MessageCircle />
              </IconLink>
              <IconLink to="/saved" label="Saved" className="hidden md:flex">
                <Heart />
              </IconLink>
              <IconLink to="/cart" label="Cart" count={count}>
                <ShoppingBag />
              </IconLink>
              <UserMenu />
            </>
          ) : (
            <>
              <ThemeToggleButton />
              <ButtonLink to="/login" variant="ghost" size="sm" className="h-9">
                Log in
              </ButtonLink>
              <ButtonLink to="/signup" variant="primary" size="sm" className="ml-1 h-9 px-4">
                Sign up
              </ButtonLink>
            </>
          )}
        </nav>
      </div>
      <div className="px-4 pb-3 md:hidden">
        <SearchBar />
      </div>
    </header>
  )
}
