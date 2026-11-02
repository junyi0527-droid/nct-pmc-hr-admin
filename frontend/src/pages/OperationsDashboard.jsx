import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, CalendarClock, CalendarDays, Car, ClipboardCheck, Download, FileText, Inbox, Plus, RefreshCw, ReceiptText, ShieldCheck, Sparkles, TrendingUp, WalletCards, Wrench } from 'lucide-react'
import api from '../lib/api'
import { useWorkflow, downloadFile, errorMessage } from '../contexts/WorkflowContext'
import { useAuth } from '../contexts/AuthContext'
import { daysUntil, formatDate } from '../lib/dates'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { RecordTable, WorkflowError } from './WorkflowPage'
import DashboardOverview from './DashboardOverview'

function DashboardHero({ user, openCount, approvalCount }) {
  const firstName = user?.full_name?.split(' ')[0] || 'HR'
  return <section className="nct-dashboard-hero">
    <div className="nct-hero-glow nct-hero-glow-a" /><div className="nct-hero-glow nct-hero-glow-b" /><div className="nct-hero-dot-grid" />
    <div className="nct-dashboard-hero-content"><div>
      <span className="nct-hero-kicker"><Sparkles size={14} /> NCT PMC · HR Administration</span>
      <h1>Welcome back, <em>{firstName}</em></h1>
      <p>Track requests, approvals and upcoming administration tasks — all your workflows in one calm, organised place.</p>
      <div className="nct-hero-pills"><span><CalendarDays size={14} /> <span>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span></span><span><Inbox size={14} /> {openCount} open requests</span><span><ClipboardCheck size={14} /> {approvalCount} approvals waiting</span></div>
      <div className="nct-hero-actions"><Link to="/workflows" className="nct-hero-primary">Open workflows <ArrowRight size={16} /></Link><Link to="/workflows" className="nct-hero-secondary"><Plus size={16} /> New request</Link></div>
    </div><div className="nct-hero-visual"><img src="/assets/hero-illustration.png" alt="HR administration tasks" /><span className="nct-floating-kpi"><TrendingUp size={18} /><strong>98%</strong><small>On-time approvals</small></span><span className="nct-floating-reminder"><CalendarClock size={16} /><strong>Road tax renewal</strong><small>due in 8 days</small></span></div></div>
  </section>
}

function DashboardCharts({ records, catalog }) {
  const statusConfig = [
    { key: 'pending', label: 'Pending', color: '#d99b22' },
    { key: 'in_progress', label: 'In progress', color: '#e4c46a' },
    { key: 'completed', label: 'Completed', color: '#b28c38' },
    { key: 'rejected', label: 'Rejected', color: '#e45b6d' },
  ]
  const statusRows = statusConfig.map((item) => ({ ...item, value: records.filter((record) => record.status === item.key).length }))
  const total = Math.max(records.length, 1)
  const groupRows = Object.entries(catalog.groups).map(([group, label]) => ({ label, value: records.filter((record) => catalog.processes[record.kind]?.group === group).length })).sort((a, b) => b.value - a.value).slice(0, 6)
  const maxGroup = Math.max(...groupRows.map((row) => row.value), 1)
  const radius = 72
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return <div className="nct-chart-grid grid grid-cols-1 gap-5 xl:grid-cols-2">
    <section className="nct-chart-card nct-status-donut-card ui-card p-5" aria-label="Request status chart">
      <div className="mb-5 flex items-center justify-between"><div><p className="nct-chart-eyebrow">WORKFLOW OVERVIEW</p><h2 className="font-semibold">Request status</h2></div><span className="nct-chart-icon"><BarChart3 size={18} /></span></div>
      <div className="nct-status-chart nct-donut-layout" role="img" aria-label={`Request status distribution across ${records.length} records`}><div className="nct-donut-wrap"><svg viewBox="0 0 190 190" aria-hidden="true"><circle cx="95" cy="95" r={radius} fill="none" stroke="#edf3ef" strokeWidth="24" />{statusRows.map((row) => { const length = (row.value / total) * circumference; const circle = <circle key={row.key} cx="95" cy="95" r={radius} fill="none" stroke={row.color} strokeWidth="24" strokeDasharray={`${Math.max(length - 3, 0)} ${circumference - Math.max(length - 3, 0)}`} strokeDashoffset={-offset} transform="rotate(-90 95 95)" />; offset += length; return circle })}</svg><div className="nct-donut-center"><strong>{records.length}</strong><span>Total requests</span></div></div><div className="nct-donut-legend">{statusRows.map((row) => <div key={row.key} className="nct-donut-legend-row"><span className="nct-legend-dot" style={{ background: row.color }} /><span>{row.label}</span><strong>{row.value}</strong><small>{Math.round((row.value / total) * 100)}%</small></div>)}</div></div>
    </section>
    <section className="nct-chart-card ui-card p-5" aria-label="Requests by workflow chart">
      <div className="mb-4 flex items-center justify-between"><div><p className="nct-chart-eyebrow">ACTIVITY MIX</p><h2 className="font-semibold">Requests by workflow</h2></div><span className="nct-chart-icon"><BarChart3 size={18} /></span></div>
      <div className="space-y-3">{groupRows.length ? groupRows.map((row) => <div key={row.label} className="nct-group-row"><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-muted">{row.label}</span><strong>{row.value}</strong></div><div className="nct-group-track"><span style={{ width: `${(row.value / maxGroup) * 100}%` }} /></div></div>) : <p className="py-8 text-sm text-muted">Charts will appear when workflow records are available.</p>}</div>
    </section>
  </div>
}

function WeeklyActivityChart({ records }) {
  const [range, setRange] = useState('7d')
  const [active, setActive] = useState(null)
  const data = range === '7d' ? [{ label: 'Mon', value: 4 }, { label: 'Tue', value: 7 }, { label: 'Wed', value: 5 }, { label: 'Thu', value: 9 }, { label: 'Fri', value: 6 }, { label: 'Sat', value: 2 }, { label: 'Sun', value: 3 }] : [{ label: '1', value: 5 }, { label: '5', value: 6 }, { label: '10', value: 4 }, { label: '15', value: 7 }, { label: '20', value: 8 }, { label: '25', value: 5 }, { label: '30', value: 7 }]
  const width = 720
  const height = 260
  const pad = { left: 38, right: 18, top: 18, bottom: 34 }
  const innerWidth = width - pad.left - pad.right
  const innerHeight = height - pad.top - pad.bottom
  const max = 9
  const points = data.map((item, index) => [pad.left + (index / (data.length - 1)) * innerWidth, pad.top + innerHeight - (item.value / max) * innerHeight])
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ')
  const area = `${line} L ${points[points.length - 1][0]} ${pad.top + innerHeight} L ${points[0][0]} ${pad.top + innerHeight} Z`
  const average = (data.reduce((sum, item) => sum + item.value, 0) / data.length).toFixed(1)
  const peak = data.reduce((best, item) => item.value > best.value ? item : best, data[0])
  const liveCount = records.length
  return <section className="nct-activity-chart ui-card" aria-label="Weekly activity trend">
    <div className="nct-activity-chart-head"><div><p className="nct-chart-eyebrow">REQUESTS ACTIVITY</p><h2>Weekly activity trend</h2><p>Incoming requests across all workflows</p></div><div className="nct-activity-chart-actions"><span className="nct-trend-chip">↗ 18% vs last week</span><div className="nct-range-toggle">{['7d', '30d'].map((item) => <button type="button" key={item} className={range === item ? 'is-active' : ''} onClick={() => { setRange(item); setActive(null) }}>{item.toUpperCase()}</button>)}</div><span className="nct-chart-icon"><BarChart3 size={18} /></span></div></div>
    <div className="nct-activity-chart-body"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Requests activity trend chart" onMouseMove={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); const x = ((event.clientX - bounds.left) / bounds.width) * width; const index = Math.round(((x - pad.left) / innerWidth) * (data.length - 1)); setActive(Math.min(data.length - 1, Math.max(0, index))) }} onMouseLeave={() => setActive(null)}><defs><linearGradient id="nctActivityFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity=".3" /><stop offset="100%" stopColor="#10b981" stopOpacity=".02" /></linearGradient></defs>{[0, 3, 6, 9].map((value) => { const y = pad.top + innerHeight - (value / max) * innerHeight; return <g key={value}><line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="nct-chart-gridline" strokeDasharray={value ? '4 5' : '0'} /><text x={pad.left - 10} y={y + 4} textAnchor="end" className="nct-chart-axis">{value}</text></g> })}<path d={area} fill="url(#nctActivityFill)" /><path d={line} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{points.map(([x, y], index) => <g key={data[index].label}><circle cx={x} cy={y} r={active === index ? 6 : 4} fill="#fff" stroke="#059669" strokeWidth="2.5" /><text x={x} y={height - 8} textAnchor="middle" className="nct-chart-axis">{data[index].label}</text></g>)}{active !== null && <g><line x1={points[active][0]} x2={points[active][0]} y1={pad.top} y2={pad.top + innerHeight} className="nct-chart-crosshair" strokeDasharray="3 4" /><rect x={Math.min(Math.max(points[active][0] - 40, 40), width - 95)} y={Math.max(points[active][1] - 52, 3)} width="80" height="34" rx="12" className="nct-chart-tooltip" /><text x={Math.min(Math.max(points[active][0], 80), width - 55)} y={Math.max(points[active][1] - 31, 24)} textAnchor="middle" className="nct-chart-tooltip-text">{data[active].label} · {data[active].value} requests</text></g>}</svg></div>
    <div className="nct-activity-chart-foot"><span>Peak · {peak.label} with <strong>{peak.value} requests</strong></span><span>Daily average <strong>{average}</strong></span><span className="nct-chart-live">{liveCount} live records</span></div>
  </section>
}

function DashboardUtilityPanels({ due, bookings }) {
  const quickActions = [{ label: 'New workflow request', detail: 'Start a new HR administration request', icon: FileText, to: '/workflows' }, { label: 'Vehicle booking', detail: 'Check availability and submit a booking', icon: Car, to: '/vehicle-borrowing/request' }, { label: 'Utility bills', detail: 'Review bills and payment status', icon: ReceiptText, to: '/utility-bills' }, { label: 'Manage renewals', detail: 'Open your calendar and due dates', icon: CalendarClock, to: '/calendar' }]
  return <div className="nct-utility-grid grid grid-cols-1 gap-5 xl:grid-cols-12">
    <section className="nct-reference-panel ui-card xl:col-span-7" aria-label="Upcoming renewals"><div className="nct-reference-panel-head"><div><p className="nct-chart-eyebrow">COMPLIANCE</p><h2>Upcoming renewals & due dates</h2><p>Licences, insurance and registrations timeline</p></div><span className="nct-chart-icon"><CalendarClock size={18} /></span></div><div className="nct-renewal-list">{due.slice(0, 4).map((item) => <Link key={item.id} to={`/records/${item.id}`} className="nct-renewal-row"><span className="nct-date-tile"><small>{new Date(item.due_date).toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</small><strong>{new Date(item.due_date).getDate()}</strong></span><span className="nct-renewal-copy"><strong>{item.title}</strong><small>{item.company || 'NCT PMC'} · {formatDate(item.due_date)}</small></span><span className="nct-renewal-chip">in {Math.max(0, daysUntil(item.due_date) ?? 0)} days</span></Link>)}{!due.length && <p className="p-5 text-sm text-muted">No upcoming renewals or due dates.</p>}</div><div className="nct-renewal-footer"><span>On-time renewal rate</span><strong>92%</strong><div><span style={{ width: '92%' }} /></div></div></section>
    <section className="nct-reference-panel ui-card xl:col-span-5" aria-label="Quick actions"><div className="nct-reference-panel-head"><div><p className="nct-chart-eyebrow">SHORTCUTS</p><h2>Quick actions</h2><p>Common tasks for your workspace</p></div><span className="nct-chart-icon"><Wrench size={18} /></span></div><div className="nct-quick-action-grid">{quickActions.map(({ label, detail, icon: Icon, to }) => <Link key={to} to={to} className="nct-quick-action"><span><Icon size={17} /></span><strong>{label}</strong><small>{detail}</small><ArrowRight size={14} /></Link>)}</div><p className="nct-booking-note"><ShieldCheck size={14} /> {bookings.filter((item) => item.status === 'approved').length} vehicle bookings approved this period</p></section>
  </div>
}

export default function OperationsDashboard({ report = false }) {
  const { catalog, records, loading, error, refresh, notifications } = useWorkflow()
  const { user } = useAuth()
  const [bookings, setBookings] = useState([])
  const [bookingError, setBookingError] = useState('')
  const [exportError, setExportError] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => { api.get('/borrowing?my=false').then((r) => setBookings(r.data)).catch(() => setBookingError('Vehicle booking counts could not be loaded.')) }, [])
  const open = records.filter((r) => !['completed', 'rejected', 'cancelled'].includes(r.status))
  const due = records.filter((r) => r.due_date && daysUntil(r.due_date) <= r.reminder_days && !['cancelled', 'rejected'].includes(r.status) && (r.status !== 'completed' || catalog.processes[r.kind]?.renewable))
  const cards = [
    { label: 'Open requests', count: open.length, icon: FileText, to: '/workflows', detail: 'Across administration workflows' },
    { label: 'Your approval inbox', count: records.filter((r) => r.actions.includes('approve')).length, icon: ClipboardCheck, to: '/approvals', detail: 'Assigned to you, in approval order' },
    { label: 'Finance queue', count: records.filter((r) => r.status === 'finance_queue').length, icon: WalletCards, to: '/finance', detail: 'Awaiting payment confirmation' },
    { label: 'Renewals & due dates', count: due.length, icon: CalendarClock, to: '/reports', detail: 'Using each record’s reminder interval' },
  ]
  async function exportCsv() { try { await downloadFile('/workflow/export', 'hr-administration.csv'); setExportError('') } catch (err) { setExportError(errorMessage(err)) } }
  const rows = records.filter((r) => `${r.title} ${r.number} ${r.company}`.toLowerCase().includes(search.toLowerCase()))
  if (!report) return <DashboardOverview user={user} records={records} catalog={catalog} loading={loading} error={error} refresh={refresh} />
  return <div className="nct-dashboard-page space-y-6">{!report && <DashboardHero user={user} openCount={open.length} approvalCount={records.filter((r) => r.actions.includes('approve')).length} />}{report && <div className="nct-dashboard-header flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">NCT PMC · HR Administration</p><h1 className="text-3xl font-bold tracking-tight">Reports & request register</h1><p className="mt-2 text-sm text-muted">Review saved requests, payment references and upcoming renewals.</p></div><div className="flex gap-2"><Button variant="outline" onClick={refresh} aria-label="Refresh dashboard"><RefreshCw className="h-4 w-4" /></Button><Button variant="teal" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button></div></div>}
    <WorkflowError error={error || exportError} retry={refresh} />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, count, icon: Icon, to, detail }) => <Link key={label} to={to} className="block rounded-xl border border-line bg-surface p-5 shadow-sm hover:border-accent"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-muted">{label}</p><Icon className="h-5 w-5 text-accent" /></div><p className="mt-4 text-4xl font-bold">{loading ? '—' : count}</p><p className="mt-3 text-xs text-muted">{detail}</p></Link>)}</div>
    {!report && <><WeeklyActivityChart records={records} /><DashboardCharts records={records} catalog={catalog} /></>}
    {!report && <div className="grid grid-cols-1 gap-5 xl:grid-cols-2"><Card className="p-5"><div className="mb-5 flex justify-between gap-3"><h2 className="font-semibold">Needs attention</h2><Badge>{due.length} due</Badge></div><div className="space-y-3">{due.sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 6).map((r) => <Link key={r.id} to={`/records/${r.id}`} className="flex items-start justify-between gap-3 rounded-lg border border-line p-3 hover:bg-subtle"><div className="min-w-0"><p className="break-words text-sm font-medium">{r.title}</p><p className="mt-1 text-xs text-muted">{r.company} · {formatDate(r.due_date)}</p></div><Badge variant={daysUntil(r.due_date) < 0 ? 'danger' : 'warning'}>{daysUntil(r.due_date) < 0 ? 'Overdue' : `${daysUntil(r.due_date)} days`}</Badge></Link>)}</div>{!due.length && <p className="py-6 text-sm text-muted">No due-date reminders. Add licences, policies, bills or maintenance schedules to track them here.</p>}</Card>
      <Card className="p-5"><h2 className="mb-5 font-semibold">Recent updates</h2><div className="space-y-3">{notifications.filter((n) => n.type === 'notice').slice(0, 5).map((n) => <Link key={n.id} to={`/records/${n.record_id}`} className="block rounded-lg border border-line p-3 text-sm hover:bg-subtle">{n.message}</Link>)}</div>{!notifications.some((n) => n.type === 'notice') && <p className="py-6 text-sm text-muted">Approval decisions, Finance updates and memos will appear here.</p>}<div className="mt-5 border-t border-line pt-4"><Link className="ui-link text-sm" to="/vehicle-borrowing">Vehicle bookings: {bookings.filter((r) => r.status === 'pending').length} pending · {bookings.filter((r) => r.status === 'approved').length} approved</Link>{bookingError && <p role="status" className="mt-2 text-xs text-muted">{bookingError}</p>}</div></Card></div>}
    {!report && <DashboardUtilityPanels due={due} bookings={bookings} />}
    {report && <Card className="p-5"><h2 className="mb-4 font-semibold">Process totals</h2><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(catalog.groups).map(([group, title]) => <div key={group} className="flex justify-between gap-3 rounded-lg bg-subtle p-3 text-sm"><span>{title}</span><span className="font-semibold">{records.filter((r) => catalog.processes[r.kind]?.group === group).length}</span></div>)}</div></Card>}
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{report ? 'All saved requests' : 'Recent requests'}</h2>{report && <input className="ui-field sm:w-80" aria-label="Search report records" placeholder="Search requests or company…" value={search} onChange={(e) => setSearch(e.target.value)} />}</div>
    <RecordTable rows={report ? rows : rows.slice(0, 8)} catalog={catalog} />
  </div>
}
