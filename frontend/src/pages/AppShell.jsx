import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import MainLayout from '../components/layout/MainLayout'

export default function AppShell() {
  const { user, loading, logout } = useAuth()
  const location = useLocation()

  if (loading) return null

  // Public routes
  const publicRoutes = ['/login']
  const isPublic = publicRoutes.includes(location.pathname)

  if (!user && !isPublic) return <Navigate to="/login" replace={true} state={{ from: location }} />
  if (user && isPublic) return <Navigate to="/dashboard" replace={true} />

  return (
    <MainLayout>
      <Outlet context={{ user, logout }} />
    </MainLayout>
  )
}
