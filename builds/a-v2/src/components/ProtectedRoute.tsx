import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

export default function ProtectedRoute() {
  const user = useAuthStore((state) => state.user)

  if (!user) {
    return <Navigate to="/signin" replace />
  }

  return <Outlet />
}
