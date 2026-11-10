import { Heart, House, MessageCircle, Plus, User } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { useAuth } from '../../context/AuthContext'
import { useInbox } from '../../context/InboxContext'
import { cn } from '../../lib/utils'

function Tab({ to, label, icon, badge, end }: { to: string; label: string; icon: ReactNode; badge?: number; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors [&_svg]:size-[21px]',
          isActive ? 'text-ink' : 'text-muted',
        )
      }
    >
      {icon}
      {label}
      {badge ? (
        <span className="absolute top-1 left-1/2 ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-ink">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </NavLink>
  )
}

export function MobileTabBar() {
  const { user, profile } = useAuth()
  const { unread } = useInbox()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-md items-end px-2">
        <Tab to="/" end label="Home" icon={<House />} />
        <Tab to="/saved" label="Saved" icon={<Heart />} />
        <NavLink to="/sell" className="flex flex-1 justify-center" aria-label="Sell an item">
          <span className="-mt-5 flex size-14 items-center justify-center rounded-2xl bg-ink text-canvas shadow-lift ring-4 ring-canvas">
            <Plus className="size-6" strokeWidth={2.4} />
          </span>
        </NavLink>
        <Tab to="/messages" label="Inbox" icon={<MessageCircle />} badge={unread} />
        <Tab
          to={user ? (profile ? `/u/${profile.username}` : '/settings') : '/login'}
          label={user ? 'You' : 'Log in'}
          icon={<User />}
        />
      </div>
    </nav>
  )
}
