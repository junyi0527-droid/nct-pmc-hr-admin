import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, FileText, Plus, RefreshCw, Search, Pencil, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { useWorkflow, errorMessage, statusLabel, statusTone } from '../contexts/WorkflowContext'
import { useAuth } from '../contexts/AuthContext'
import { daysUntil, formatDate } from '../lib/dates'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import CalendarView from '../components/ui/CalendarView'
import UtilityBillCalendar from '../components/workflow/UtilityBillCalendar'
import RecordForm from '../components/workflow/RecordForm'
import WorkflowRules from '../components/workflow/WorkflowRules'
import ConfirmDialog from '../components/ui/ConfirmDialog'

export function WorkflowError({ error, retry }) {
  return error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 text-sm"><span className="text-[var(--app-danger)]">{error}</span><Button variant="outline" size="sm" onClick={retry}>Try again</Button></div> : null
}

export function RecordTable({ rows, catalog, onEdit, onArchive }) {
  return <div className="overflow-x-auto rounded-xl border border-line bg-surface"><table className="w-full text-left text-sm"><caption className="sr-only">Workflow records</caption>
    <thead className="border-b border-line bg-subtle text-xs text-muted"><tr>{['Request', 'Process', 'Company', 'Stage', 'Due / expiry', 'Amount', 'Actions'].map((text) => <th key={text} className="px-4 py-3 font-medium">{text}</th>)}</tr></thead>
    <tbody>{rows.map((record) => <tr key={record.id} className="border-b border-line last:border-0 hover:bg-subtle">
      <td className="min-w-48 px-4 py-4"><Link className="ui-link font-semibold" to={`/records/${record.id}`}>{record.title}</Link><p className="mt-1 text-xs text-muted">{record.number}</p></td>
      <td className="px-4 py-4">{catalog.processes[record.kind]?.title}</td><td className="px-4 py-4">{record.company}</td>
      <td className="min-w-44 px-4 py-4"><Badge variant={statusTone(record.status)}>{statusLabel(record.status)}</Badge><p className="mt-1 text-xs text-muted">{record.steps[record.step_index]?.label || 'Workflow closed'}</p></td>
      <td className="whitespace-nowrap px-4 py-4">{record.due_date ? <><span>{formatDate(record.due_date)}</span>{daysUntil(record.due_date) < 0 && record.status !== 'completed' && <p className="text-xs text-[var(--app-danger)]">Overdue</p>}</> : '—'}</td>
      <td className="whitespace-nowrap px-4 py-4">{record.data.amount ? `RM ${Number(record.data.amount).toFixed(2)}` : record.data.items ? `RM ${record.data.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0).toFixed(2)}` : '—'}</td>
      <td className="px-4 py-4">
        {record.can_edit && <Button size="sm" variant="outline" onClick={() => onEdit(record)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>}
        {!record.archived && <Button size="sm" variant="outline" onClick={() => onArchive(record)}><Trash2 className="h-3.5 w-3.5" /> Archive</Button>}
      </td>
    </tr>)}</tbody>
  </table>{rows.length === 0 && <div className="px-6 py-14 text-center"><FileText className="mx-auto mb-3 h-8 w-8 text-muted" /><p className="font-medium">No records found</p><p className="mt-1 text-sm text-muted">Create a request or change your filters.</p></div>}</div>
}

export default function WorkflowPage({ group, mode }) {
  const { catalog, records, loading, error, refresh } = useWorkflow()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState(params.get('type') || '')
  const [status, setStatus] = useState(params.get('status') || '')
  const [view, setView] = useState(mode === 'approvals' ? 'inbox' : 'table')
  const [creating, setCreating] = useState(params.has('new'))
  const [editing, setEditing] = useState(null)
  const [archive, setArchive] = useState([])
  const [archiveError, setArchiveError] = useState('')
  const [archivingId, setArchivingId] = useState(null)
  const [archiveConfirmId, setArchiveConfirmId] = useState(null)
  useEffect(() => { if (view === 'archive') api.get('/workflow/records?archived=true').then((r) => { setArchive(r.data); setArchiveError('') }).catch((err) => setArchiveError(errorMessage(err))) }, [view, records])
  const types = Object.entries(catalog.processes).filter(([, value]) => !group || value.group === group)
  const rows = (view === 'archive' ? archive : records).filter((r) => {
    if (group && catalog.processes[r.kind]?.group !== group) return false
    if (mode === 'finance' && r.status !== 'finance_queue') return false
    if (mode === 'approvals' && view === 'inbox' && !r.actions.includes('approve')) return false
    return (!kind || r.kind === kind) && (!status || r.status === status) && `${r.title} ${r.number} ${r.company} ${JSON.stringify(r.data)}`.toLowerCase().includes(search.toLowerCase())
  })
  const title = mode === 'approvals' ? 'Approvals' : mode === 'finance' ? 'Finance queue' : catalog.groups[group] || 'All requests'
  const views = mode === 'approvals' ? ['inbox', 'all', 'rules'] : ['table', 'calendar', ...(group === 'memos' ? ['board'] : []), 'archive']

  const handleArchive = async (id) => {
    const record = rows.find((r) => r.id === id)
    if (!record) return
    setArchivingId(id)
    try {
      await api.post(`/workflow/records/${id}/actions`, { action: 'archive', revision: record.revision })
      setArchiveConfirmId(null)
      setArchivingId(null)
      refresh()
    } catch (err) {
      setArchiveError(errorMessage(err))
      setArchivingId(null)
    }
  }
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">NCT HR Adminstration</p><h1 className="text-3xl font-bold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted">{mode === 'approvals' ? 'Review assigned requests and maintain confirmed company approval rules.' : mode === 'finance' ? 'Review approved handoffs and record payment references and evidence.' : 'Manage requests, documents and the next step in each workflow.'}</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={refresh} aria-label="Refresh records"><RefreshCw className="h-4 w-4" /></Button>{!mode && <Button variant="teal" disabled={loading || !types.length} onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New record</Button>}</div>
    </div>
    <WorkflowError error={error || archiveError} retry={refresh} />
    <div className="flex flex-wrap gap-2 border-b border-line pb-3">{views.map((item) => <Button key={item} size="sm" variant={view === item ? 'teal' : 'ghost'} onClick={() => setView(item)}>{statusLabel(item)}{item === 'inbox' ? ` (${records.filter((r) => r.actions.includes('approve')).length})` : ''}</Button>)}</div>
    {view === 'rules' ? <WorkflowRules /> : <>
      <div className="flex flex-wrap gap-3"><label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted" /><input aria-label="Search requests" className="ui-field pl-9" placeholder="Search number, company or details…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <select aria-label="Filter process" className="ui-field max-w-full sm:w-64" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">All processes</option>{types.map(([key, item]) => <option key={key} value={key}>{item.title}</option>)}</select>
        <select aria-label="Filter status" className="ui-field sm:w-48" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{['draft', 'in_progress', 'changes_requested', 'pending_approval', 'finance_queue', 'completed', 'rejected', 'cancelled'].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select>
      </div>
      <p className="text-xs text-muted" role="status">{loading ? 'Loading records…' : `${rows.length} record${rows.length === 1 ? '' : 's'}`}</p>
      {view === 'calendar' ? group === 'utilities' ? <UtilityBillCalendar /> : <CalendarView events={rows.filter((r) => r.due_date).map((r) => ({ id: r.id, title: r.title, date: r.due_date, subtitle: r.company, tone: daysUntil(r.due_date) < 0 ? 'danger' : 'info' }))} onOpen={(event) => { window.location.href = `/records/${event.id}` }} title={`${title} calendar`} /> : view === 'board' ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{['draft', 'in_progress', 'pending_approval', 'completed'].map((stage) => <Card key={stage} className="p-4"><h2 className="mb-4 text-sm font-semibold">{statusLabel(stage)} <Badge>{rows.filter((r) => r.status === stage).length}</Badge></h2><div className="space-y-3">{rows.filter((r) => r.status === stage).map((r) => <Link key={r.id} to={`/records/${r.id}`} className="block rounded-lg border border-line p-3 hover:bg-subtle"><span className="text-xs text-muted">{r.number}</span><p className="mt-2 text-sm font-medium">{r.title}</p></Link>)}</div></Card>)}</div> : <RecordTable rows={rows} catalog={catalog} onEdit={(record) => setEditing(record)} onArchive={(record) => setArchiveConfirmId(record.id)} />}
    </>}
    {creating && <RecordForm open onClose={() => { setCreating(false); if (params.has('new')) { const next = new URLSearchParams(params); next.delete('new'); setParams(next) } }} group={group} initialKind={params.get('type') || kind || undefined} />}
    {editing && <RecordForm open record={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }} />}
    {archiveConfirmId !== null && <ConfirmDialog open={true} onContinue={() => handleArchive(archiveConfirmId)} onDiscard={() => setArchiveConfirmId(null)} />}
  </div>
}
