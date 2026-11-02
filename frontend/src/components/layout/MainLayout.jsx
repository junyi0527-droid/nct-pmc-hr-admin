import { Suspense, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import CommandPalette from './CommandPalette'
import Skeleton from '../ui/Skeleton'
import '../../pages/workspace-effects.css'
import './workspace-theme.css'

export default function MainLayout({ user, logout }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const mainRef = useRef(null)
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <div className="nct-workspace-shell emerald-workspace min-h-dvh bg-canvas relative overflow-hidden">
      {/* 3D Animated Background Orbs */}
      <div className="floating-orb w-96 h-96 bg-accent-soft rounded-full top-[-10%] left-[-10%]" style={{ animationDelay: '0s' }}></div>
      <div className="floating-orb w-80 h-80 bg-warning-soft rounded-full top-[20%] right-[-5%]" style={{ animationDelay: '2s' }}></div>
      <div className="floating-orb w-64 h-64 bg-success-soft rounded-full bottom-[-10%] left-[20%]" style={{ animationDelay: '4s' }}></div>
      <div className="floating-orb w-48 h-48 bg-danger-soft rounded-full top-[60%] right-[20%]" style={{ animationDelay: '6s' }}></div>

      <CommandPalette />
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        user={user}
        logout={logout}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div
        className={`min-w-0 transition-[padding] duration-200 ${
          collapsed ? 'md:pl-[78px]' : 'md:pl-[264px]'
        }`}
      >
        <TopNav
          collapsed={collapsed}
          onMenuToggle={() => setCollapsed(!collapsed)}
          onMobileMenu={() => setMobileOpen(true)}
          user={user}
        />
        <main
          ref={mainRef}
          id="main-content"
          tabIndex={-1}
          className="mx-auto min-w-0 max-w-[1600px] scroll-mt-24 px-4 pb-8 pt-24 focus:outline-none sm:px-6 lg:px-8 relative z-10"
        >
          <Suspense
            fallback={
              <div role="status" className="space-y-4">
                <span className="sr-only">Loading page</span>
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-64 w-full" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
