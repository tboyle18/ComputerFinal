import { ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../../context/AuthContext'
import { ButtonLink } from '../ui/Button'
import { EmptyState, PageLoader } from '../ui/Feedback'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <EmptyState
          icon={ShieldAlert}
          title="Admins only"
          description="This area is for marketplace administrators. If you think you should have access, ask an existing admin to promote your account."
          action={<ButtonLink to="/">Back to the marketplace</ButtonLink>}
        />
      </div>
    )
  }
  return <>{children}</>
}

/** Keeps signed-in users away from /login and /signup. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (loading) return <PageLoader />
  if (user) return <Navigate to={from} replace />
  return <>{children}</>
}
