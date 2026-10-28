import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Building2,
  Car,
  FileCheck,
  CreditCard,
  ShieldAlert,
  BarChart3,
  UserCog,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { key: 'licence', label: 'Business Licence', icon: Building2, to: '/business-licence' },
  { key: 'insurance', label: 'Vehicle Insurance', icon: FileCheck, to: '/vehicle-insurance' },
  { key: 'borrowing', label: 'Vehicle Borrowing', icon: Car, to: '/vehicle-borrowing' },
  { key: 'utility', label: 'Utility Bills', icon: CreditCard, to: '/utility-bills' },
  { key: 'memo', label: 'Memo Approval', icon: FileText, to: '/memo' },
  { key: 'approvals', label: 'Approvals', icon: ShieldAlert, to: '/approvals' },
  { key: 'reports', label: 'Reports', icon: BarChart3, to: '/reports' },
  { key: 'users', label: 'User Management', icon: UserCog, to: '/users' },
  { key: 'settings', label: 'Settings', icon: Settings, to: '/settings' },
]

export default function Sidebar({ collapsed, onToggle, user }) {
  const navigate = useNavigate()
  const active = navigate ? null : null

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 transition-all duration-300 ease-in-out flex flex-col ${
          collapsed ? 'w-16' : 'w-64'
        } border-r border-slate-200 bg-white`}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 px-3 h-14 border-b border-slate-200 bg-navy-900 text-white">
          {!collapsed && (
            <span className="font-bold text-lg tracking-tight">NCT PMC</span>
          )}
          {collapsed && <span className="font-bold text-lg tracking-tight">NP</span>}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.to)}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  typeof window !== 'undefined' && window.location.pathname === item.to
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${!collapsed ? 'shrink-0' : 'mx-auto'}`} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* User + Logout (bottom) */}
        <div className="px-3 py-4 border-t border-slate-200">
          <button
            onClick={() => navigate('/settings')}
            className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors text-slate-600 hover:bg-slate-50 hover:text-slate-900`}
          >
            <Settings className={`w-5 h-5 ${!collapsed ? 'shrink-0' : 'mx-auto'}`} />
            {!collapsed && <span>Settings</span>}
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('nct_hr_token')
              window.location.href = '/login'
            }}
            className={`mt-2 flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors text-red-600 hover:bg-red-50 hover:text-red-700`}
          >
            <LogOut className={`w-5 h-5 ${!collapsed ? 'shrink-0' : 'mx-auto'}`} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>

        {/* Collapse toggle (only when expanded) */}
        {!collapsed && (
          <button
            onClick={onToggle}
            className="absolute right-0 top-1/2 -mt-6 mr-2 p-2 text-slate-400 hover:text-slate-700"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
      </aside>

      {/* Collapse toggle (only when collapsed) */}
      {collapsed && (
        <button
          onClick={onToggle}
          className="fixed left-16 top-6 z-50 p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </>
  )
}
