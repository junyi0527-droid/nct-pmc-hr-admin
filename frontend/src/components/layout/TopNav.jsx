import { useEffect, useState } from 'react'
import { ArrowRight as NotificationArrow, Bell, ChevronDown, LogOut, Menu, Moon, RefreshCw, Search, Settings, Sun } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useWorkflow } from '../../contexts/WorkflowContext'
import Button from '../ui/Button'
import NotificationCentre from './NotificationCentre'
import { NAV } from './Sidebar'

const ROLE_LABELS = {
  system_administrator: 'System Administrator',
  hr_admin: 'HR Admin',
  finance: 'Finance',
  authorised_approver: 'Authorised Approver',
}

export default function TopNav({ onMenuToggle, onMobileMenu, user, collapsed }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { dark, toggleTheme } = useTheme()
  const { notifications, refresh } = useWorkflow()
  const { logout } = useAuth()
  const notify = useToast()
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => {
    const dismiss = (event) => document.querySelectorAll('.workspace-account-menu[open]').forEach((menu) => { if (event.key === 'Escape' || (event.type === 'pointerdown' && !menu.contains(event.target))) menu.removeAttribute('open') })
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', dismiss)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss) }
  }, [])
  async function refreshWorkspace() {
    if (refreshing) return
    setRefreshing(true)
    await Promise.all([refresh(), new Promise((resolve) => setTimeout(resolve, 900))])
    setRefreshing(false)
    notify?.('Workspace refresh finished.')
  }
  const unread = notifications.filter((item) => !item.read).length
  const location = useLocation()
  const page = NAV.find((item) => location.pathname.startsWith(item.to))?.label || 'Workspace'
  return (
    <>
      <header
        className={`nct-workspace-topnav fixed inset-x-0 top-0 z-30 flex h-18 min-w-0 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6 ${collapsed ? 'md:left-[78px]' : 'md:left-[264px]'}`}
      >
        <Button
          variant="ghost"
          className="md:hidden"
          onClick={onMobileMenu}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          className="hidden md:inline-flex"
          onClick={onMenuToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden min-w-0 text-sm text-muted lg:block">
          Workspace{' '}
          <span aria-hidden="true" className="px-2">
            /
          </span>
          <span className="font-medium text-ink">{page}</span>
        </div>
        <button
          className="ml-auto flex min-w-0 items-center gap-2 rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-muted"
          onClick={() => window.dispatchEvent(new Event('nct:command'))}
          aria-label="Open search and navigation"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden xl:inline">Search workspace…</span>
          <kbd className="hidden rounded border border-line px-1.5 text-[10px] sm:inline">
            Ctrl K
          </kbd>
        </button>
        <Button variant="ghost" size="sm" onClick={refreshWorkspace} disabled={refreshing} aria-label="Refresh workspace"><RefreshCw className={`h-4 w-4 ${refreshing ? 'workspace-refresh-spin' : ''}`} /></Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={dark ? 'Light mode' : 'Dark mode'}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <details className="workspace-account-menu">
        <summary className="workspace-bell-trigger" aria-label={`Open notifications, ${unread} unread`}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--app-danger)]"
            />
          )}
        </summary>
        <div className="workspace-account-popup workspace-notification-feed"><p>Notifications<small>{unread} unread</small></p>{notifications.slice(0, 5).map((item) => <Link key={item.id} to={`/records/${item.record_id}`} onClick={(event) => event.currentTarget.closest('details').removeAttribute('open')}><Bell size={14} /><span>{item.message}</span></Link>)}{!notifications.length && <p>You’re all caught up.</p>}<button type="button" onClick={(event) => { event.currentTarget.closest('details').removeAttribute('open'); setNotificationsOpen(true) }}>View notification centre <NotificationArrow size={14} /></button></div>
        </details>
        <details className="workspace-account-menu">
        <summary className="workspace-account-trigger">
        <div
          className="flex min-w-0 shrink-0 items-center gap-2 border-l border-line pl-3"
          aria-label={`Signed in as ${user?.full_name}`}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent"
            aria-hidden="true"
          >
            {user?.full_name
              ?.split(' ')
              .map((part) => part[0])
              .slice(0, 2)
              .join('') || 'U'}
          </span>
          <div className="hidden max-w-44 lg:block">
            <p className="truncate text-xs font-semibold">{user?.full_name}</p>
            <p className="text-[11px] text-muted">{ROLE_LABELS[user?.role] || 'Team member'}</p>
          </div>
        </div>
        <ChevronDown className="h-3.5 w-3.5" />
        </summary>
        <div className="workspace-account-popup"><p>{user?.full_name}<small>{user?.email}</small></p><Link to="/settings" onClick={(event) => event.currentTarget.closest('details').removeAttribute('open')}><Settings size={15} /> Workspace settings</Link><button type="button" onClick={toggleTheme}>{dark ? <Sun size={15} /> : <Moon size={15} />}{dark ? 'Light mode' : 'Dark mode'}</button><button type="button" onClick={logout}><LogOut size={15} /> Sign out</button></div>
        </details>
      </header>
      <NotificationCentre open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </>
  )
}
