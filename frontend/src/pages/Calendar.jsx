import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import api from '../lib/api'
import { useWorkflow, errorMessage, statusLabel, statusTone } from '../contexts/WorkflowContext'
import { addDays, daysUntil, formatDate, todayKey } from '../lib/dates'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import RecordForm from '../components/workflow/RecordForm'

const MODULES = {
  licences: { label: 'Business licences', color: '#b7791f' }, insurance: { label: 'Vehicle insurance', color: '#2563eb' },
  borrowing: { label: 'Vehicle borrowing', color: '#0e7c7b' }, utilities: { label: 'Utility bills', color: '#7c3aed' },
  memos: { label: 'Memos', color: '#16803c' }, claims: { label: 'Petty cash / claims', color: '#be185d' },
  inventory: { label: 'Uniforms / inventory', color: '#9333ea' }, other: { label: 'Other', color: '#64748b' },
}

const dateKey = (value) => value ? String(value).slice(0, 10) : ''
function moduleForRecord(record, catalog) {
  const group = catalog.processes[record.kind]?.group
  return ['licences', 'insurance', 'utilities', 'memos', 'claims', 'inventory'].includes(group) ? group : 'other'
}
function workflowEvents(record, catalog) {
  const module = moduleForRecord(record, catalog)
  const events = []
  if (record.due_date) events.push({ id: `${record.id}-due`, recordId: record.id, title: record.title, date: record.due_date, kind: record.kind, module, type: 'Due date' })
  if (record.reminder_date) events.push({ id: `${record.id}-reminder`, recordId: record.id, title: `Reminder · ${record.title}`, date: record.reminder_date, kind: record.kind, module, type: 'Reminder' })
  const fields = { new_expiry_date: 'Renewal / expiry', service_date: 'Service date', next_service_date: 'Next service', delivery_date: 'Expected delivery', expense_date: 'Expense date', retention_review_date: 'Retention review' }
  Object.entries(fields).forEach(([key, type]) => { const date = dateKey(record.data?.[key]); if (date) events.push({ id: `${record.id}-${key}`, recordId: record.id, title: record.title, date, kind: record.kind, module, type }) })
  return events
}
function weekStart(date) { const day = new Date(`${date}T12:00:00Z`).getUTCDay(); return addDays(date, day === 0 ? -6 : 1 - day) }
function monthStart(date) { return `${date.slice(0, 7)}-01` }

function CalendarGrid({ dates, events, onSelectDate, onOpen }) {
  const byDate = useMemo(() => events.reduce((map, event) => { (map[event.date] ||= []).push(event); return map }, {}), [events])
  return <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-line">
    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <div key={day} className="border-b border-line bg-subtle p-3 text-center text-xs font-semibold text-muted">{day}</div>)}
    {dates.map((date) => <div key={date} className={`min-h-32 border-b border-r border-line p-2 ${date === todayKey() ? 'bg-accent-soft' : ''}`}>
      <button className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs ${date === todayKey() ? 'bg-accent font-bold text-white' : 'text-muted hover:bg-subtle'}`} onClick={() => onSelectDate(date)} aria-label={`Create record on ${formatDate(date)}`}>{Number(date.slice(-2))}</button>
      <div className="space-y-1">{(byDate[date] || []).slice(0, 3).map((event) => <button key={event.id} onClick={() => onOpen(event)} className="block w-full truncate rounded px-1.5 py-1 text-left text-[11px] text-white" style={{ backgroundColor: MODULES[event.module]?.color || MODULES.other.color }} title={`${event.title} · ${event.type}`}>{event.type === 'Reminder' ? '↗ ' : ''}{event.title}</button>)}{(byDate[date] || []).length > 3 && <button className="ui-link text-xs" onClick={() => onSelectDate(date)}>+{byDate[date].length - 3} more</button>}</div>
    </div>)}
  </div>
}

export default function CalendarPage() {
  const { catalog, records } = useWorkflow()
  const [bookings, setBookings] = useState([])
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(todayKey())
  const [selectedDate, setSelectedDate] = useState('')
  const [search, setSearch] = useState('')
  const [module, setModule] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [createDate, setCreateDate] = useState(todayKey())

  useEffect(() => { api.get('/borrowing?my=false').then((response) => setBookings(response.data)).catch((err) => setError(errorMessage(err))) }, [])
  const events = useMemo(() => {
    const workflow = records.flatMap((record) => workflowEvents(record, catalog))
    const vehicle = bookings.map((booking) => ({ id: `booking-${booking.id}`, bookingId: booking.id, title: `${booking.request_number} · ${booking.purpose}`, date: dateKey(booking.borrow_date), endDate: dateKey(booking.return_date), module: 'borrowing', type: 'Vehicle booking', status: booking.status, subtitle: `${booking.borrow_time}–${booking.return_time}` }))
    return [...workflow, ...vehicle].filter((event) => event.date)
  }, [records, catalog, bookings])
  const filteredEvents = events.filter((event) => {
    const record = event.recordId ? records.find((row) => row.id === event.recordId) : null
    const haystack = `${event.title} ${record?.company || ''} ${record?.number || ''}`.toLowerCase()
    return (!search || haystack.includes(search.toLowerCase())) && (!module || event.module === module) && (!status || (record?.status || event.status) === status)
  })
  const visibleDates = useMemo(() => {
    if (view === 'day') return [cursor]
    if (view === 'week') return Array.from({ length: 7 }, (_, index) => addDays(weekStart(cursor), index))
    const start = monthStart(cursor); const day = new Date(`${start}T12:00:00Z`).getUTCDay(); const first = addDays(start, day === 0 ? -6 : 1 - day)
    return Array.from({ length: 42 }, (_, index) => addDays(first, index))
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
  const openCreate = (date = selectedDate || cursor) => { setCreateDate(date); setCreating(true) }
  const openEvent = (event) => { window.location.href = event.recordId ? `/records/${event.recordId}` : `/vehicle-borrowing/request/${event.bookingId}` }
  const title = view === 'day' ? formatDate(cursor) : view === 'week' ? `Week of ${formatDate(weekStart(cursor))}` : new Intl.DateTimeFormat('en-MY', { month: 'long', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(`${cursor}T12:00:00Z`))
  const selectedEvents = selectedDate ? filteredEvents.filter((event) => event.date <= selectedDate && (event.endDate || event.date) >= selectedDate) : []

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">Planning & deadlines</p><h1 className="text-3xl font-bold tracking-tight">Calendar</h1><p className="mt-2 text-sm text-muted">Dates from saved workflow records and vehicle bookings.</p></div><Button variant="teal" onClick={() => openCreate()}><Plus className="h-4 w-4" /> Create record</Button></div>
    {error && <p role="alert" className="rounded-lg border border-line p-3 text-sm text-[var(--app-danger)]">{error}</p>}
    <div className="flex flex-wrap gap-3"><label className="relative min-w-64 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted" /><input className="ui-field pl-9" aria-label="Search calendar" placeholder="Search title, company or reference…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select className="ui-field sm:w-52" aria-label="Filter calendar module" value={module} onChange={(event) => setModule(event.target.value)}><option value="">All modules</option>{Object.entries(MODULES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select><select className="ui-field sm:w-48" aria-label="Filter calendar status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{['draft', 'in_progress', 'pending_approval', 'finance_queue', 'completed', 'pending', 'approved'].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></div>
    <Card><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5"><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-accent" /><h2 className="font-semibold">{title}</h2></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setCursor(todayKey())}>Today</Button><Button size="sm" variant="ghost" aria-label="Previous period" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button><Button size="sm" variant="ghost" aria-label="Next period" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>{['month', 'week', 'day'].map((item) => <Button key={item} size="sm" variant={view === item ? 'teal' : 'outline'} onClick={() => setView(item)}>{statusLabel(item)}</Button>)}</div></div><div className="p-5">{view === 'month' ? <CalendarGrid dates={visibleDates} events={filteredEvents} onSelectDate={(date) => { setSelectedDate(date); openCreate(date) }} onOpen={openEvent} /> : <div className="space-y-3">{visibleDates.map((date) => <div key={date} className="rounded-lg border border-line p-3"><div className="mb-2 flex items-center justify-between"><button className="font-semibold hover:text-accent" onClick={() => { setSelectedDate(date); openCreate(date) }}>{formatDate(date)}</button><span className="text-xs text-muted">{filteredEvents.filter((event) => event.date <= date && (event.endDate || event.date) >= date).length} event(s)</span></div><div className="space-y-1">{filteredEvents.filter((event) => event.date <= date && (event.endDate || event.date) >= date).map((event) => <button key={event.id} onClick={() => openEvent(event)} className="block w-full rounded px-3 py-2 text-left text-sm text-white" style={{ backgroundColor: MODULES[event.module]?.color || MODULES.other.color }}>{event.title}<span className="ml-2 text-xs opacity-80">{event.type}{event.subtitle ? ` · ${event.subtitle}` : ''}</span></button>)}{!filteredEvents.some((event) => event.date <= date && (event.endDate || event.date) >= date) && <p className="text-sm text-muted">No scheduled records.</p>}</div></div>)}</div>}</div></Card>
    <div className="flex flex-wrap gap-3 text-xs">{Object.entries(MODULES).map(([key, item]) => <span key={key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>)}</div>
    {selectedDate && <Card><div className="flex items-center justify-between p-5"><div><h2 className="font-semibold">{formatDate(selectedDate)}</h2><p className="text-sm text-muted">{selectedEvents.length} scheduled item(s)</p></div><Button size="sm" variant="teal" onClick={() => openCreate(selectedDate)}><Plus className="h-4 w-4" /> Create on this date</Button></div><div className="space-y-2 p-5 pt-0">{selectedEvents.map((event) => <button key={event.id} onClick={() => openEvent(event)} className="flex w-full items-center gap-3 rounded-lg border border-line p-3 text-left hover:bg-subtle"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: MODULES[event.module]?.color || MODULES.other.color }} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{event.title}</span><span className="text-xs text-muted">{event.type} · {event.subtitle || ''}</span></span>{event.recordId && <Badge variant={statusTone(records.find((row) => row.id === event.recordId)?.status)}>{statusLabel(records.find((row) => row.id === event.recordId)?.status)}</Badge>}{daysUntil(event.date) < 0 && <span className="text-xs text-[var(--app-danger)]">Overdue</span>}</button>)}</div></Card>}
    {creating && <RecordForm open onClose={() => { setCreating(false); refresh() }} prefill={{ due_date: createDate }} />}
  </div>
}
