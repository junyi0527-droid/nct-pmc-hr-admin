import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Menu, Search, User } from 'lucide-react'

export default function TopNav({ onMenuToggle, user }) {
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 h-14 border-b border-slate-200 bg-white z-30 flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden md:flex items-center relative">
          <Search className="absolute left-3 top-1/2 -mt-2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search…"
            className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none w-64"
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 border border-white" />
          </button>
          <div className="relative group">
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2 rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            >
              <div className="w-8 h-8 rounded-full bg-navy-900 flex items-center justify-center text-white text-xs font-semibold">
                {(user?.full_name || 'U').charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:block text-sm font-medium text-slate-900">
                {user?.full_name || 'User'}
              </span>
              <span className={`text-xs ${user?.role ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'} px-1.5 py-0.5 rounded-full`}>
                {user?.role}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
