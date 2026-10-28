import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopNav from './TopNav'

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  // Public routes should not render the app shell
  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
        collapsed ? 'pl-16' : 'pl-64'
      }`}>
        <TopNav onMenuToggle={() => setCollapsed(!collapsed)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
