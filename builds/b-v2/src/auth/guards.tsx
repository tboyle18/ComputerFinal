import type { ReactNode } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router';
import { useAuth } from './AuthProvider';
import { PageLoader } from '../components/ui';
import { safeNextPath } from '../lib/redirect';

/**
 * Route guards are a UX convenience only. They stop signed-out users from
 * seeing empty pages, but every piece of data is protected server-side by RLS.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

/** Login/sign-up pages: once signed in, continue to the (validated) ?next= page. */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to={safeNextPath(params.get('next'))} replace />;
  return <>{children}</>;
}
