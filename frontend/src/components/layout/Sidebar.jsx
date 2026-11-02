import { Fragment } from 'react'
import { NavLink } from 'react-router-dom'
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
  ShoppingCart,
  WalletCards,
  Shirt,
  Wrench,
  FolderOpen,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Calendar,
} from 'lucide-react'
import Dialog from '../ui/Dialog'
import Button from '../ui/Button'
import { useWorkflow } from '../../contexts/WorkflowContext'

export const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Workflow Directory', icon: FileText, to: '/workflows' },
  { label: 'Licences, MOF & CIDB', icon: Building2, to: '/business-licence' },
  { label: 'Insurance & Road Tax', icon: FileCheck, to: '/vehicle-insurance' },
  { label: 'Vehicle Borrowing', icon: Car, to: '/vehicle-borrowing' },
  { label: 'Utility Bills', icon: CreditCard, to: '/utility-bills' },
  { label: 'Purchasing', icon: ShoppingCart, to: '/purchase-requisitions' },
  { label: 'Petty Cash', icon: WalletCards, to: '/petty-cash' },
  { label: 'Uniforms & Inventory', icon: Shirt, to: '/uniforms' },
  { label: 'Maintenance', icon: Wrench, to: '/maintenance' },
  { label: 'Memo Approval', icon: FileText, to: '/memo' },
  { label: 'Documents & E-Forms', icon: FolderOpen, to: '/documents' },
  { label: 'Approvals', icon: ShieldAlert, to: '/approvals' },
  { label: 'Payment Requests', icon: CreditCard, to: '/payments' },
  { label: 'Finance Queue', icon: WalletCards, to: '/finance', finance: true },
  { label: 'Reports', icon: BarChart3, to: '/reports' },
  { label: 'Calendar', icon: Calendar, to: '/calendar' },
  { label: 'User Management', icon: UserCog, to: '/users', admin: true },
  { label: 'Settings', icon: Settings, to: '/settings' },
]

export default function Sidebar({ collapsed, onToggle, user, logout, mobileOpen, onMobileClose }) {
  const canManageUsers = ['admin', 'system_administrator'].includes(user?.role)
  const { records } = useWorkflow()
  const badgeCount = (to) => to === '/approvals' ? records.filter((r) => r.actions?.includes('approve')).length : to === '/utility-bills' ? records.filter((r) => ['electricity_bill', 'water_bill', 'telephone_bill', 'utility_bill'].includes(r.kind) && !['completed', 'cancelled', 'rejected'].includes(r.status)).length : to === '/memo' ? records.filter((r) => r.kind?.includes('memo') && r.actions?.includes('approve')).length : 0
  const navigation = (compact = false, onNavigate) => (
    <nav aria-label="Main navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
      {NAV.filter((item) => (!item.admin || canManageUsers) && (!item.finance || ['system_administrator', 'hr_admin', 'finance'].includes(user?.role))).map(({ label, to, icon: Icon }) => (
        <Fragment key={to}>
        {!compact && ['/dashboard', '/business-licence', '/memo', '/reports'].includes(to) && <p className="workspace-nav-group">{{ '/dashboard': 'Overview', '/business-licence': 'Administration', '/memo': 'Approvals', '/reports': 'Insights' }[to]}</p>}
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          aria-label={compact ? label : undefined}
          title={compact ? label : undefined}
          className={({ isActive }) =>
            `flex min-h-10 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${compact ? 'justify-center' : ''} ${isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-subtle hover:text-ink'}`
          }
        >
          <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          {!compact && <span>{label}</span>}
          {badgeCount(to) > 0 && <span className={compact ? 'workspace-nav-dot' : 'workspace-nav-count'} aria-label={`${badgeCount(to)} pending`}>{compact ? '' : badgeCount(to)}</span>}
        </NavLink>
        </Fragment>
      ))}
    </nav>
  )
  return (
    <>
      <aside
        className={`nct-workspace-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-surface transition-[width] duration-200 md:flex ${collapsed ? 'w-[78px]' : 'w-[264px]'}`}
      >
        <div className="nct-workspace-sidebar-brand flex h-20 shrink-0 items-center justify-center bg-[#1e3a5f] px-3">
          <img className="workspace-official-logo" src="/assets/nct-official-logo.png" alt="NCT Alliance" width="50" height="60" />
          {!collapsed && <span className="workspace-brand-copy"><strong>NCT ALLIANCE</strong><small>HR Administration</small></span>}
        </div>
        {navigation(collapsed)}
        <div className="shrink-0 space-y-1 border-t border-line p-3">
          {!collapsed && <div className="workspace-sidebar-user"><span>{user?.full_name?.split(' ').map((part) => part[0]).slice(0, 2).join('') || 'HR'}</span><div><strong>{user?.full_name}</strong><small>{user?.email || 'HR Administration'}</small></div></div>}
          <Button
            variant="ghost"
            className="w-full"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span>Collapse sidebar</span>
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-[var(--app-danger)]"
            onClick={logout}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && 'Sign out'}
          </Button>
        </div>
      </aside>
      <Dialog open={mobileOpen} onClose={onMobileClose} title="NCT PMC navigation" navigation>
        {navigation(false, onMobileClose)}
        <Button variant="ghost" className="mt-3 w-full" onClick={logout}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </Dialog>
    </>
  )
}
