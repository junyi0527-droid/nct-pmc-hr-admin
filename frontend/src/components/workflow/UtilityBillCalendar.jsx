import { useCallback, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Download, Plus, Search, AlertCircle, Clock } from 'lucide-react'
import { generateICS, downloadICS } from '../../lib/ics'
import { addDays, daysUntil, formatDate, todayKey } from '../../lib/dates'
import { useWorkflow, statusLabel, statusTone } from '../../contexts/WorkflowContext'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import RecordForm from './RecordForm'

const UTILITIES = [
  { key: 'Electricity', label: 'Electricity' },
  { key: 'Water', label: 'Water' },
  { key: 'Internet', label: 'Internet' },
  { key: 'Telephone', label: 'Telephone' },
  { key: 'Other', label: 'Other' },
]
const ROUTES = ['HR Admin handling', 'Direct to Finance', 'Payment on behalf / reimbursement']
const STATUS_GROUPS = {
  Draft: { label: 'Draft', statuses: ['draft'], color: 'var(--app-muted)' },
  Submitted: { label: 'Submitted', statuses: ['in_progress', 'pending_approval', 'finance_queue', 'changes_requested'], color: 'var(--app-warning)' },
  Paid: { label: 'Paid', statuses: ['completed'], color: 'var(--app-green)' },
}
function statusGroup(status) {
  for (const [key, group] of Object.entries(STATUS_GROUPS)) if (group.statuses.includes(status)) return key
  return 'Draft'
}
function isOverdue(record) {
  if (!record.due_date || record.status === 'completed') return false
  return daysUntil(record.due_date) < 0
}
function monthStart(date) { return `${date.slice(0, 7)}-01` }
function weekStart(date) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay()
  return addDays(date, day === 0 ? -6 : 1 - day)
}
export default function UtilityBillCalendar() {
  const { records, loading, error, refresh } = useWorkflow()
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(todayKey())
  const [creating, setCreating] = useState(false)
  const [createDate, setCreateDate] = useState(todayKey())
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [utilityFilter, setUtilityFilter] = useState('')
  const [routeFilter, setRouteFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [upcomingOpen, setUpcomingOpen] = useState(true)

  const bills = useMemo(() => records.filter((r) => r.kind === 'utility_bill'), [records])
  const companies = useMemo(() => [...new Set(bills.map((b) => b.company).filter(Boolean))].sort(), [bills])

  const filteredBills = useMemo(() => bills.filter((b) => {
    if (search) {
      const h = `${b.title} ${b.number} ${b.company} ${b.data?.utility_type || ''} ${b.data?.invoice_number || ''}`.toLowerCase()
      if (!h.includes(search.toLowerCase())) return false
    }
    if (companyFilter && b.company !== companyFilter) return false
    if (utilityFilter && b.data?.utility_type !== utilityFilter) return false
    if (routeFilter && b.data?.payment_route !== routeFilter) return false
    if (statusFilter && b.status !== statusFilter) return false
    return true
  }), [bills, search, companyFilter, utilityFilter, routeFilter, statusFilter])

  const billsWithDue = useMemo(() => filteredBills.filter((b) => b.due_date), [filteredBills])
  const noDueDateBills = useMemo(() => filteredBills.filter((b) => !b.due_date), [filteredBills])
  const monthTotal = useMemo(() => billsWithDue.filter((b) => b.due_date.slice(0, 7) === cursor.slice(0, 7)).reduce((s, b) => s + (Number(b.data?.amount) || 0), 0), [billsWithDue, cursor])
  const upcoming = useMemo(() => {
    const today = todayKey(), in7 = addDays(today, 7)
    return billsWithDue.filter((b) => b.status !== 'completed' && b.due_date >= today && b.due_date <= in7).sort((a, b) => a.due_date.localeCompare(b.due_date))
  }, [billsWithDue])
  const events = useMemo(() => {
    const evs = []
    for (const b of billsWithDue) {
      evs.push({ id: `${b.id}-due`, recordId: b.id, title: b.title, date: b.due_date, type: 'Due', amount: b.data?.amount ? Number(b.data.amount).toFixed(2) : '0.00', status: b.status, overdue: isOverdue(b) })
      if (b.reminder_date) evs.push({ id: `${b.id}-reminder`, recordId: b.id, title: `Reminder · ${b.title}`, date: b.reminder_date, type: 'Reminder', amount: b.data?.amount ? Number(b.data.amount).toFixed(2) : '0.00', status: b.status, overdue: false })
    }
    return evs
  }, [billsWithDue])
  const eventsOn = (date) => events.filter((e) => e.date === date)
  const visibleDates = useMemo(() => {
    if (view === 'week') return Array.from({ length: 7 }, (_, i) => addDays(weekStart(cursor), i))
    const start = monthStart(cursor), day = new Date(`${start}T12:00:00Z`).getUTCDay(), first = addDays(start, day === 0 ? -6 : 1 - day)
    return Array.from({ length: 42 }, (_, i) => addDays(first, i))
  }, [cursor, view])
  const navigate = (delta) => {
    if (view === 'month') {
      const date = new Date(`${monthStart(cursor)}T12:00:00Z`)
      date.setUTCMonth(date.getUTCMonth() + delta)
      setCursor(date.toISOString().slice(0, 10))
      return
    }
    setCursor(addDays(cursor, (view === 'week' ? 7 : 1) * delta))
  }
  const openCreate = (date) => { setCreateDate(date); setCreating(true) }
  const openRecord = (id) => { window.location.href = `/records/${id}` }
  const title = view === 'month' ? new Intl.DateTimeFormat('en-MY', { month: 'long', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(`${cursor}T12:00:00Z`)) : view === 'week' ? `Week of ${formatDate(weekStart(cursor))}` : 'Utility bills list'
  const handleExport = useCallback(() => { const content = generateICS({ records: billsWithDue }); downloadICS(content) }, [billsWithDue])
  const monthLabel = new Intl.DateTimeFormat('en-MY', { month: 'long', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(`${cursor}T12:00:00Z`))
  if (loading) return <div className="p-6 text-muted">Loading utility bills…</div>
  if (error) return <div role="alert" className="p-6 rounded-lg border border-line bg-surface text-sm text-[var(--app-danger)]">{error}</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">Utility Bill Management · Process 11</p>
          <h1 className="text-3xl font-bold tracking-tight">Bill Calendar</h1>
          <p className="mt-2 text-sm text-muted">View bills by due date, track reminders and monitor upcoming payments.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={refresh} aria-label="Refresh bills"><Clock className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4" /> Export to calendar</Button>
          <Button variant="teal" size="sm" onClick={() => openCreate()}><Plus className="h-4 w-4" /> New bill</Button>
        </div>
      </div>
      {error && <p role="alert" className="rounded-lg border border-line p-3 text-sm text-[var(--app-danger)]">{error}</p>}

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <label className="relative min-w-64 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted" /><input className="ui-field pl-9" placeholder="Search title, company, invoice…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
            <select className="ui-field" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
              <option value="">All companies</option>
              {companies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="ui-field" value={utilityFilter} onChange={(e) => setUtilityFilter(e.target.value)}>
              <option value="">All utilities</option>
              {UTILITIES.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
            </select>
            <select className="ui-field" value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)}>
              <option value="">All bill routes</option>
              {ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className="ui-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_GROUPS).map(([key, g]) => <option key={key} value={g.statuses.join(',')}>{g.label}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Monthly total</span>
            <span className="text-lg font-bold">RM {monthTotal.toFixed(2)}</span>
            <span className="text-xs text-muted">bills due in {monthLabel}</span>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setUpcomingOpen(!upcomingOpen)} className="flex items-center gap-2 text-sm font-medium hover:text-accent">
          <AlertCircle className={`h-4 w-4 ${upcomingOpen ? 'rotate-180' : ''}`} />
          {upcomingOpen ? '▾ Upcoming in 7 days' : '▸ Upcoming in 7 days'}
        </button>
        <span className="text-xs text-muted">{upcoming.length} bill{(upcoming.length !== 1 ? 's' : '')}</span>
      </div>
      {upcomingOpen && (
        <Card className="p-4">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted">No bills due in the next 7 days.</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3 hover:bg-subtle cursor-pointer" onClick={() => openRecord(b.id)}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{b.title}</span>
                      <Badge variant={isOverdue(b) ? 'danger' : statusTone(b.status)}>{isOverdue(b) ? 'Overdue' : statusLabel(b.status)}</Badge>
                    </div>
                    <p className="text-xs text-muted">{b.company} · {b.data?.utility_type || '—'} · {formatDate(b.due_date)}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">RM {Number(b.data?.amount || 0).toFixed(2)}</div>
                    <span className="text-[10px] text-muted">{b.data?.payment_route || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 hidden md:flex">
          <span className="text-xs text-muted">View:</span>
          {['month', 'week', 'list'].map((v) => (
            <Button key={v} size="sm" variant={view === v ? 'teal' : 'outline'} onClick={() => setView(v)}>
              {statusLabel(v)}
            </Button>
          ))}
        </div>

        {view === 'month' && (
          <Card className="w-full min-w-[600px]">
            <div className="flex items-center justify-between border-b border-line p-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-accent" /><h2 className="font-semibold">{title}</h2>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setCursor(todayKey())}>Today</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-7 border-b border-line bg-subtle p-2 text-[10px] font-semibold text-muted">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="text-center py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {visibleDates.map((date) => {
                const dayEvents = eventsOn(date)
                const isToday = date === todayKey()
                const isCurrentMonth = date.slice(0, 7) === cursor.slice(0, 7)
                return (
                  <div key={date} className={`min-h-[90px] border-b border-r border-line p-2 ${!isCurrentMonth ? 'bg-muted/30' : ''} ${isToday ? 'ring-1 ring-accent' : ''}`}>
                    <button
                      onClick={() => openCreate(date)}
                      className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors"
                      aria-label={`Create bill on ${formatDate(date)}`}
                    >
                      {Number(date.slice(-2))}
                    </button>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((e) => (
                        <button
                          key={e.id}
                          onClick={() => openRecord(e.recordId)}
                          className="block w-full truncate rounded px-1 py-0.5 text-[10px] leading-none"
                          style={{
                            backgroundColor: e.overdue ? '#dc2626' : STATUS_GROUPS[statusGroup(e.status)]?.color || '#6b7280',
                            color: '#ffffff',
                          }}
                          title={`${e.title} · ${e.type} · RM ${e.amount} · ${e.status}`}
                        >
                          {e.type === 'Reminder' ? '↷ ' : ''}{e.title}
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <button className="block w-full rounded px-1 py-0.5 text-[10px] text-muted hover:bg-muted">
                          +{dayEvents.length - 3} more
                        </button>
                      )}
                      {!dayEvents.length && <div className="h-2" />}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] p-3 border-t border-line bg-muted/30">
              {Object.entries(STATUS_GROUPS).map(([key, g]) => (
                <span key={key} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} /> {g.label}</span>
              ))}
              <span className="flex items-center gap-1.5 ml-auto"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#dc2626' }} /> Overdue</span>
            </div>
          </Card>
        )}

        {view === 'week' && (
          <Card className="w-full min-w-[600px]">
            <div className="flex items-center justify-between border-b border-line p-4">
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 text-accent" /><h2 className="font-semibold">{title}</h2>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setCursor(todayKey())}>Today</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-7 border-b border-line p-3 text-[10px] font-semibold text-muted">
              {visibleDates.map((d) => <div key={d} className="text-center py-1">{formatDate(d, { day: 'numeric', month: 'short' })}</div>)}
            </div>
            <div className="divide-y divide-line">
              {visibleDates.map((date) => {
                const dayEvents = eventsOn(date)
                return (
                  <div key={date} className="grid grid-cols-7 p-3 min-h-[48px] hover:bg-muted/50 transition-colors group">
                    <div className="col-span-1 whitespace-nowrap px-2 py-1 text-sm font-medium text-muted text-right">{formatDate(date)}</div>
                    <div className="col-span-6 px-2 py-1 space-y-1">
                      {dayEvents.length ? (
                        dayEvents.map((e) => (
                          <button
                            key={e.id}
                            onClick={() => openRecord(e.recordId)}
                            className="flex items-center gap-2 rounded px-2 py-1 text-sm text-left"
                            style={{ backgroundColor: e.overdue ? '#dc2626' : STATUS_GROUPS[statusGroup(e.status)]?.color || '#6b7280' }}
                          >
                            <span className="truncate">{e.title}</span>
                            <span className="ml-auto text-[10px] opacity-90">RM {e.amount}</span>
                          </button>
                        ))
                      ) : (
                        <span className="text-[10px] text-muted">No bills</span>
                      )}
                    </div>
                    <div className="col-span-1 px-2 py-1 text-[10px] text-muted text-right">
                      {date === todayKey() && <span className="text-xs font-medium">Today</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {view === 'list' && (
          <Card className="w-full min-w-[600px]">
            <div className="p-4 border-b border-line">
              <h2 className="font-semibold flex items-center gap-2">{billsWithDue.length} bill{(billsWithDue.length !== 1 ? 's' : '')} with due dates</h2>
            </div>
            <div className="divide-y divide-line">
              {billsWithDue.length ? (
                billsWithDue.slice().sort((a, b) => a.due_date.localeCompare(b.due_date)).map((b) => (
                  <div key={b.id} onClick={() => openRecord(b.id)} className="p-4 hover:bg-subtle cursor-pointer transition-colors group">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{b.title}</span>
                          <Badge variant={isOverdue(b) ? 'danger' : statusTone(b.status)}>{isOverdue(b) ? 'Overdue' : statusLabel(b.status)}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted">{b.number} · {b.company} · {b.data?.utility_type || '—'} · {formatDate(b.due_date)}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">RM {Number(b.data?.amount || 0).toFixed(2)}</div>
                        {b.reminder_date && <span className="text-[10px] text-muted block mt-0.5">Reminder {formatDate(b.reminder_date)}</span>}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-muted">No bills with due dates.</div>
              )}
            </div>
          </Card>
        )}
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2"><AlertCircle className="h-5 w-5 text-muted" /> No due date ({noDueDateBills.length})</h2>
          <span className="text-xs text-muted">Not shown on calendar</span>
        </div>
        {noDueDateBills.length ? (
          <div className="space-y-2 divide-y divide-line/50">
            {noDueDateBills.map((b) => (
              <div key={b.id} onClick={() => openRecord(b.id)} className="p-3 hover:bg-subtle cursor-pointer transition-colors group">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">{b.title}</span>
                    <p className="text-xs text-muted">{b.number} · {b.company} · {b.data?.utility_type || '—'} · Status: {statusLabel(b.status)}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">RM {Number(b.data?.amount || 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">All bills have a due date recorded.</p>
        )}
      </Card>

      {creating && (
        <RecordForm
          open
          initialKind="utility_bill"
          prefill={{ due_date: createDate }}
          onClose={() => { setCreating(false); refresh() }}
          onSaved={() => { setCreating(false); refresh() }}
        />
      )}
    </div>
  )
}
