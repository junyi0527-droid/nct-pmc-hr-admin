import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import MainLayout from '../components/layout/MainLayout'

export function PublicLayout() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

export function ProtectedLayout() {
  const { user, loading, logout } = useAuth()
  const location = useLocation()

  // Do not render the shell until the persisted session has been checked.
  if (loading) return null

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <MainLayout user={user} logout={logout} />
}
