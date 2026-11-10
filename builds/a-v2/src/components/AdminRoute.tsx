import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

export default function AdminRoute() {
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)

  // Security: Verify both authentication and admin status
  if (!user || !profile || !profile.is_admin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
