import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, CalendarDays, CheckCircle2, LayoutList, ListFilter, Plus } from 'lucide-react'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useAuth } from '../contexts/AuthContext'
import { MODULES, canEditDemo } from '../data/workspace'
import { daysUntil, dueLabel, formatDate, todayKey, urgency } from '../lib/dates'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import DataTable from '../components/ui/DataTable'
import CalendarView from '../components/ui/CalendarView'
import Dialog from '../components/ui/Dialog'
import RecordPanel from '../components/ui/RecordPanel'

export function DemoRecordForm({ open, onClose, module }) {
  const { addRecord } = useWorkspace()
  const config = MODULES[module]
  function submit(e) {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(e.currentTarget))
    addRecord({
      ...data,
      module,
      status: module === 'memos' ? 'Draft' : 'Recorded',
      amount: module === 'bills' ? Number(data.amount) : undefined,
    })
    e.currentTarget.reset()
    onClose()
  }
  return (
    <Dialog open={open} onClose={onClose} title={`${config.action} · demo`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">Create a sample record in this demo workspace.</p>
        <label className="block text-sm font-medium">
          Record name
          <input name="title" required maxLength={180} className="ui-field mt-1" />
        </label>
        <label className="block text-sm font-medium">
          Company
          <input name="company" required maxLength={180} className="ui-field mt-1" />
        </label>
        <label className="block text-sm font-medium">
          {config.dateLabel}
          <input
            type="date"
            name="date"
            required
            defaultValue={todayKey()}
            className="ui-field mt-1"
          />
        </label>
        <label className="block text-sm font-medium">
          Responsible person
          <input name="owner" required maxLength={120} className="ui-field mt-1" />
        </label>
        {module === 'bills' && (
          <>
            <label className="block text-sm font-medium">
              Amount (RM)
              <input
                name="amount"
                type="number"
                required
                min="0.01"
                step="0.01"
                className="ui-field mt-1"
              />
            </label>
            <label className="block text-sm font-medium">
              Payment route
              <select name="route" className="ui-field mt-1">
                <option>Unassigned</option>
                <option>HR Admin handling</option>
                <option>Direct to Finance</option>
              </select>
            </label>
            <p className="text-xs italic text-[var(--app-warning)]">
              Routing criteria [to confirm]. Select a route explicitly.
            </p>
          </>
        )}
        {module === 'insurance' && (
          <label className="block text-sm font-medium">
            Road tax expiry
            <input type="date" name="roadTaxDate" className="ui-field mt-1" />
          </label>
        )}
        <div className="flex flex-wrap justify-end gap-2 pt-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="teal">
            Create demo record
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export default function ProcessPage({ module }) {
  const { records, archiveRecords } = useWorkspace()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState('timeline')
  const [selected, setSelected] = useState(params.get('record'))
  const [creating, setCreating] = useState(params.has('new'))
  const config = MODULES[module]
  const canEdit = canEditDemo(user?.role)
  const filter = params.get('filter') || params.get('status') || ''
  const all = records.filter((row) => row.module === module && !row.archived)
  const rows = all
    .filter((row) => {
      if (['expiring-30-days', 'due-30-days'].includes(filter))
        return daysUntil(row.date) >= 0 && daysUntil(row.date) <= 30 && row.status !== 'Complete'
      if (filter === 'active') return daysUntil(row.date) >= 0
      if (filter === 'overdue') return daysUntil(row.date) < 0 && row.status !== 'Complete'
      if (filter === 'outstanding') return row.status !== 'Complete'
      return !filter || row.status === filter
    })
    .sort((a, b) => a.date.localeCompare(b.date))
  const selectedRecord = all.find((row) => row.id === (params.get('record') || selected))
  function closeRecord() {
    setSelected(null)
    const next = new URLSearchParams(params)
    next.delete('record')
    setParams(next, { replace: true })
  }
  function closeCreate() {
    setCreating(false)
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
  }
  const overdue = all.filter((row) => daysUntil(row.date) < 0 && row.status !== 'Complete')
  const events = rows.flatMap((row) => [
    { id: row.id, title: row.title, date: row.date, tone: urgency(row.date), recordId: row.id },
    ...(module === 'insurance' && row.roadTaxDate
      ? [
          {
            id: `${row.id}-tax`,
            title: `Road tax · ${row.title}`,
            date: row.roadTaxDate,
            tone: urgency(row.roadTaxDate),
            recordId: row.id,
          },
        ]
      : []),
  ])
  const columns = [
    { key: 'id', label: 'Reference' },
    { key: 'title', label: 'Item' },
    { key: 'company', label: 'Company' },
    {
      key: 'date',
      label: config.dateLabel,
      render: (row) => (
        <>
          <p>{formatDate(row.date)}</p>
          <span className={`ui-badge mt-1 tone-${urgency(row.date)}`}>{dueLabel(row.date)}</span>
        </>
      ),
    },
    ...(module === 'bills'
      ? [
          {
            key: 'route',
            label: 'Route',
            render: (row) => (
              <Badge variant={row.route === 'Direct to Finance' ? 'info' : 'default'}>
                {row.route}
              </Badge>
            ),
          },
          {
            key: 'amount',
            label: 'Amount',
            render: (row) => `RM ${Number(row.amount).toFixed(2)}`,
          },
        ]
      : []),
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'Complete' ? 'success' : 'warning'}>{row.status}</Badge>
      ),
    },
  ]
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="info">Demo process view</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{config.title}</h1>
          <p className="mt-2 text-sm text-muted">{config.description}</p>
        </div>
        {canEdit && (
          <Button variant="teal" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            {config.action}
          </Button>
        )}
      </div>
      {module === 'bills' && (
        <>
          <div className="tone-danger flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 text-sm">
            <span>
              <b>{overdue.length} overdue bills</b> · RM{' '}
              {overdue.reduce((sum, row) => sum + Number(row.amount), 0).toFixed(2)} to review
            </span>
            <button
              className="rounded font-semibold underline underline-offset-4"
              onClick={() => setParams({ status: 'overdue' })}
            >
              View overdue
            </button>
          </div>
          <p className="text-xs italic text-[var(--app-warning)]">
            Finance-direct routing criteria and HR recording responsibilities [to confirm].
          </p>
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1"
          role="group"
          aria-label="Display mode"
        >
          {[
            { id: 'timeline', title: 'Timeline', icon: LayoutList },
            { id: 'calendar', title: 'Calendar', icon: CalendarDays },
            { id: 'list', title: 'Table', icon: ListFilter },
          ].map(({ id, title, icon: Icon }) => (
            <Button
              key={id}
              size="sm"
              variant={view === id ? 'primary' : 'ghost'}
              aria-pressed={view === id}
              onClick={() => setView(id)}
            >
              <Icon className="h-4 w-4" />
              {title}
            </Button>
          ))}
        </div>
        <label className="flex min-w-0 items-center gap-2 text-xs text-muted">
          Filter
          <select
            value={filter}
            className="ui-field w-auto max-w-60"
            onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}
          >
            <option value="">All records</option>
            <option value="active">Active</option>
            <option value="expiring-30-days">Next 30 days</option>
            {filter === 'due-30-days' && <option value="due-30-days">Renewals in 30 days</option>}
            <option value="overdue">Overdue</option>
            {module === 'bills' && <option value="outstanding">Outstanding</option>}
          </select>
        </label>
      </div>
      {view === 'calendar' ? (
        <CalendarView
          events={events}
          title={module === 'bills' ? 'Bill due dates' : 'Expiry calendar'}
          onOpen={(event) => setSelected(event.recordId)}
        />
      ) : view === 'list' ? (
        <Card>
          <DataTable
            caption={config.title}
            columns={columns}
            rows={rows}
            selectable={canEdit}
            onBulkAction={archiveRecords}
            onOpen={(row) => setSelected(row.id)}
          />
        </Card>
      ) : (
        <Card>
          <div className="border-b border-line p-5">
            <h2 className="font-semibold">
              {module === 'bills' ? 'Payment due timeline' : 'Upcoming expiries'}
            </h2>
            <p className="mt-1 text-xs text-muted">
              Select a record to view its progress and approval history.
            </p>
          </div>
          <div className="p-5">
            {rows.length ? (
              <ol className="space-y-4 border-l border-line pl-4">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="relative flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line p-4"
                  >
                    <span
                      className={`absolute -left-[1.4rem] h-2.5 w-2.5 rounded-full ${daysUntil(row.date) < 0 ? 'bg-[var(--app-danger)]' : 'bg-accent'}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted">
                        {formatDate(row.date)} · {row.id}
                      </p>
                      <h3 className="mt-1 break-words text-sm font-semibold">{row.title}</h3>
                      <p className="mt-1 text-xs text-muted">
                        {row.company} · {row.owner}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant={row.status === 'Complete' ? 'success' : urgency(row.date)}>
                          {row.status === 'Complete' ? 'Complete' : dueLabel(row.date)}
                        </Badge>
                        {row.route === 'Direct to Finance' && (
                          <Badge variant="info">Direct to Finance</Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelected(row.id)}
                      aria-label={`Open ${row.title}`}
                    >
                      Open <ArrowRight className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="py-10 text-center text-sm text-muted">
                <CheckCircle2 className="mx-auto mb-3 h-6 w-6 text-accent" />
                Nothing needs attention for this filter.
              </div>
            )}
          </div>
        </Card>
      )}
      <RecordPanel record={selectedRecord} onClose={closeRecord} />
      <DemoRecordForm
        open={canEdit && (creating || params.has('new'))}
        onClose={closeCreate}
        module={module}
      />
    </div>
  )
}
