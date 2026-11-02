import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Building2,
  CalendarClock,
  CarFront,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  ReceiptText,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import CountUp from '../components/ui/CountUp'
import DataTable from '../components/ui/DataTable'
import Skeleton from '../components/ui/Skeleton'
import RecordPanel from '../components/ui/RecordPanel'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useAuth } from '../contexts/AuthContext'
import { MODULES, canEditDemo } from '../data/workspace'
import { addDays, daysUntil, dueLabel, formatDate, todayKey, urgency } from '../lib/dates'
import api from '../lib/api'

export default function Dashboard() {
  const { user } = useAuth()
  const { records } = useWorkspace()
  const [range, setRange] = useState('30')
  const [selected, setSelected] = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [bookingError, setBookingError] = useState(false)
  useEffect(() => {
    let active = true
    api
      .get('/borrowing?my=false')
      .then((response) => {
        if (active) setBookings(response.data)
      })
      .catch(() => {
        if (active) setBookingError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])
  const available = records.filter((row) => !row.archived)
  const incomplete = available.filter((row) => !['Complete', 'Approved'].includes(row.status))
  const upcoming = (module) =>
    incomplete.filter(
      (row) => row.module === module && daysUntil(row.date) >= 0 && daysUntil(row.date) <= 30
    ).length
  const bills = incomplete.filter((row) => row.module === 'bills')
  const pendingBookings = bookings.filter((row) => row.status === 'pending')
  const stats = [
    {
      label: 'Active business licences',
      value: available.filter((row) => row.module === 'licences' && daysUntil(row.date) >= 0)
        .length,
      detail: 'Current register',
      icon: Building2,
      tone: 'info',
      to: '/business-licence?status=active',
    },
    {
      label: 'Licences expiring soon',
      value: upcoming('licences'),
      detail: 'Within the next 30 days',
      icon: CalendarClock,
      tone: 'warning',
      to: '/business-licence?filter=expiring-30-days',
    },
    {
      label: 'Insurance renewals due',
      value: upcoming('insurance'),
      detail: 'Within the next 30 days',
      icon: FileCheck2,
      tone: 'warning',
      to: '/vehicle-insurance?filter=due-30-days',
    },
    {
      label: 'Pending vehicle requests',
      value: bookingError ? null : pendingBookings.length,
      detail: bookingError ? 'Booking data unavailable' : 'Awaiting approval · live API',
      icon: CarFront,
      tone: pendingBookings.length ? 'warning' : 'info',
      to: '/vehicle-borrowing?status=pending',
    },
    {
      label: 'Outstanding utility bills',
      value: bills.length,
      detail: `${bills.filter((row) => daysUntil(row.date) < 0).length} overdue`,
      icon: ReceiptText,
      tone: bills.some((row) => daysUntil(row.date) < 0) ? 'danger' : 'info',
      to: '/utility-bills?status=outstanding',
      split: true,
    },
    {
      label: 'Pending memo approvals',
      value: available.filter((row) => row.module === 'memos' && row.status === 'Pending approval')
        .length,
      detail: 'Ready for sign-off',
      icon: ClipboardCheck,
      tone: 'warning',
      to: '/memo?status=Pending+approval',
    },
  ]
  const attention = [
    ...incomplete.filter((row) => daysUntil(row.date) <= 30),
    ...pendingBookings.map((row) => ({
      id: row.id,
      title: `${row.request_number} · ${row.vehicle?.plate_number || 'Vehicle booking'}`,
      date: row.borrow_date,
      module: 'borrowing',
      to: `/vehicle-borrowing?record=${row.id}`,
    })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)
  const chartData = useMemo(
    () =>
      Array.from({ length: Number(range) }, (_, i) => {
        const date = addDays(todayKey(), i - Number(range) + 1)
        return {
          date,
          label: formatDate(date, { year: undefined }),
          renewals: (i * 7 + 3) % 5,
          requests: (i * 3 + 2) % 7,
        }
      }),
    [range]
  )
  const recent = available
    .flatMap((row) =>
      row.history.map((event, index) => ({
        id: `${row.id}-${index}`,
        actor: event.actor,
        action: event.title,
        title: row.title,
        at: event.at,
      }))
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8)
  const greeting = user?.full_name?.split(' ')[0] || 'there'
  const activeRecord = available.find((row) => row.id === selected)
  return (
    <div className="space-y-6">
      {/* 3D Hero Welcome Section */}
      <Card tilt3d={true} className="p-6 sm:p-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 bg-accent-soft rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" aria-hidden="true" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[.15em] text-accent">
              Your workspace, at a glance
            </p>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-2 text-sm text-muted">
              Welcome back, {greeting}. Here’s what needs your attention.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info" className="pulse-glow">
              Demo operations data
            </Badge>
            <span className="text-xs text-muted">{formatDate(todayKey())} · MYT</span>
          </div>
        </div>
      </Card>
      <section
        aria-label="Key performance indicators"
        className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {stats.map(({ label, value, detail, icon: Icon, tone, to, split }) => (
          <Link
            key={label}
            to={to}
            className="group min-w-0 rounded-card hover-lift"
            aria-label={`${label}: ${value ?? 'Unavailable'}. Open filtered list.`}
          >
            <Card tilt3d={true} className="flex h-full flex-col p-5 transition-shadow group-hover:shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div className={`rounded-xl p-2.5 tone-${tone}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <ArrowDownRight className="h-4 w-4 text-muted transition-transform group-hover:translate-y-0.5" />
              </div>
              <p className="mt-4 text-sm font-medium text-muted">{label}</p>
              <div className="mt-1 text-3xl font-bold tabular-nums">
                {loading && label === 'Pending vehicle requests' ? (
                  <Skeleton className="h-9 w-16" />
                ) : value == null ? (
                  '—'
                ) : (
                  <CountUp value={value} />
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant={tone}>
                  {tone === 'danger' ? 'Overdue' : tone === 'warning' ? 'Attention' : 'Overview'}
                </Badge>
                <span className="text-xs text-muted">{detail}</span>
              </div>
              {split && (
                <div className="mt-3 border-t border-line pt-3 text-xs text-muted">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>
                      <b className="text-ink">
                        {bills.filter((row) => row.route === 'HR Admin handling').length}
                      </b>{' '}
                      HR Admin handling
                    </span>
                    <span>
                      <b className="text-ink">
                        {bills.filter((row) => row.route === 'Direct to Finance').length}
                      </b>{' '}
                      Direct to Finance
                    </span>
                  </div>
                  <p className="mt-2 italic text-[var(--app-warning)]">
                    Routing criteria [to confirm]
                  </p>
                </div>
              )}
            </Card>
          </Link>
        ))}
      </section>
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between">
          <div>
            <CardTitle>Needs attention</CardTitle>
            <p className="mt-1 text-sm text-muted">
              Your five most urgent items, ordered by due date.
            </p>
          </div>
          <Badge variant="warning">{attention.length} to review</Badge>
        </CardHeader>
        <CardContent>
          {attention.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-7 w-7 text-accent" />
              <p className="text-muted">Nothing needs attention.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {attention.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${daysUntil(row.date) < 0 ? 'bg-[var(--app-danger)]' : 'bg-[var(--app-warning)]'}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">{row.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {MODULES[row.module]?.title || 'Vehicle booking'} · {formatDate(row.date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={urgency(row.date)}>{dueLabel(row.date)}</Badge>
                    {row.module === 'borrowing' ? (
                      <Link className="ui-link text-sm" to={row.to}>
                        Open booking
                      </Link>
                    ) : (
                      <button
                        className="ui-link rounded px-2 py-2 text-sm"
                        aria-label={`Review ${row.title}`}
                        onClick={() => setSelected(row.id)}
                      >
                        Review <ArrowRight className="inline h-3 w-3" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {canEditDemo(user?.role) && (
        <section aria-labelledby="actions-title">
          <h2 id="actions-title" className="mb-3 text-sm font-semibold text-muted">
            Quick actions
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { title: 'New vehicle booking', to: '/vehicle-borrowing/request', icon: CarFront },
              { title: 'Add utility bill', to: '/utility-bills?new=1', icon: ReceiptText },
              { title: 'New memo', to: '/memo?new=1', icon: ClipboardCheck },
              { title: 'Add licence', to: '/business-licence?new=1', icon: Building2 },
            ].map(({ title, to, icon: Icon }) => (
              <Link
                className="ui-card flex items-center gap-3 p-4 text-sm font-semibold hover:bg-accent-soft"
                to={to}
                key={to}
              >
                <Icon className="h-4 w-4 text-accent" />
                {title}
              </Link>
            ))}
          </div>
        </section>
      )}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>
              <Activity className="mr-2 inline h-4 w-4 text-accent" />
              Activity overview
            </CardTitle>
            <p className="mt-1 text-sm text-muted">
              Fictional daily activity · use the selector to explore a date range.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            Date range
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="ui-field w-auto"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </label>
        </CardHeader>
        <CardContent>
          <div className="h-72 min-w-0" aria-label="Administrative activity chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                accessibilityLayer
                margin={{ top: 10, right: 8, left: 0, bottom: 24 }}
              >
                <CartesianGrid stroke="var(--app-line)" vertical={false} strokeDasharray="4 4" />
                <XAxis
                  dataKey="label"
                  minTickGap={32}
                  stroke="var(--app-muted)"
                  fontSize={11}
                  label={{
                    value: 'Date (MYT)',
                    position: 'insideBottom',
                    offset: -18,
                    fill: 'var(--app-muted)',
                  }}
                />
                <YAxis
                  width={36}
                  allowDecimals={false}
                  stroke="var(--app-muted)"
                  fontSize={11}
                  label={{
                    value: 'Items',
                    angle: -90,
                    position: 'insideLeft',
                    fill: 'var(--app-muted)',
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--app-surface)',
                    borderColor: 'var(--app-line)',
                    borderRadius: 12,
                    color: 'var(--app-ink)',
                  }}
                />
                <Legend verticalAlign="top" height={36} />
                <Area
                  name="Renewals"
                  dataKey="renewals"
                  stroke="#538bb8"
                  strokeDasharray="5 3"
                  fill="#538bb820"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Area
                  name="Requests"
                  dataKey="requests"
                  stroke="var(--app-accent)"
                  fill="var(--app-accent-soft)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-4 text-xs text-muted">
            <summary className="cursor-pointer py-2 font-medium">
              View chart data as a table
            </summary>
            <DataTable
              caption="Chart data"
              rows={chartData.map((row) => ({ ...row, id: row.date }))}
              columns={[
                { key: 'date', label: 'Date' },
                { key: 'renewals', label: 'Renewals' },
                { key: 'requests', label: 'Requests' },
              ]}
            />
          </details>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Recent activities</CardTitle>
            <p className="mt-1 text-sm text-muted">Latest eight actions in this demo workspace.</p>
          </div>
          <Link to="/reports?view=activity" className="ui-link text-xs">
            View all
          </Link>
        </CardHeader>
        <DataTable
          caption="Recent activities"
          rows={recent}
          columns={[
            { key: 'actor', label: 'Actor' },
            { key: 'action', label: 'Action' },
            { key: 'title', label: 'Item' },
            { key: 'at', label: 'Date/time (MYT)', render: (row) => formatDate(row.at) },
          ]}
        />
      </Card>
      <RecordPanel record={activeRecord} onClose={() => setSelected(null)}>
        {activeRecord && (
          <Link
            to={`${MODULES[activeRecord.module].route}?record=${activeRecord.id}`}
            className="ui-button ui-button-teal px-4 text-sm"
            onClick={() => setSelected(null)}
          >
            Open record <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </RecordPanel>
    </div>
  )
}
