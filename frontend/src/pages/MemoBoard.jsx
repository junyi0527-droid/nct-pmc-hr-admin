import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GripVertical, Plus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { useToast } from '../contexts/ToastContext'
import { MEMO_STAGES, canEditDemo, canMoveMemo } from '../data/workspace'
import { formatDate } from '../lib/dates'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import RecordPanel from '../components/ui/RecordPanel'
import { DemoRecordForm } from './ProcessPage'

export default function MemoBoard() {
  const { user } = useAuth()
  const { records, updateRecord } = useWorkspace()
  const notify = useToast()
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [dragOver, setDragOver] = useState('')
  const memos = records.filter((row) => row.module === 'memos' && !row.archived)
  const filter = params.get('status') || ''
  const canEdit = canMoveMemo(user?.role)
  const canApprove = ['system_administrator', 'authorised_approver'].includes(user?.role)
  function allowed(row, status) {
    return (
      canEdit &&
      Math.abs(MEMO_STAGES.indexOf(row.status) - MEMO_STAGES.indexOf(status)) === 1 &&
      ((status !== 'Approved' && row.status !== 'Approved') || canApprove)
    )
  }
  function move(id, status) {
    const row = memos.find((memo) => memo.id === id)
    if (!row || !allowed(row, status)) {
      notify('That move is unavailable in this sample workflow.')
      return
    }
    updateRecord(id, { status })
  }
  function closeRecord() {
    setSelected(null)
    const next = new URLSearchParams(params)
    next.delete('record')
    setParams(next, { replace: true })
  }
  function closeCreate() {
    setCreateOpen(false)
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="info">Demo workflow</Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Memo Approval</h1>
          <p className="mt-2 text-sm text-muted">
            Drag cards between adjacent stages, or use the Move to menu.
          </p>
        </div>
        {canEditDemo(user?.role) && (
          <Button variant="teal" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New memo
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs italic text-[var(--app-warning)]">
          Approval stages and role responsibilities [to confirm]. Moves update demo data only.
        </p>
        {filter && (
          <Button size="sm" variant="outline" onClick={() => setParams({})}>
            Clear filter: {filter}
          </Button>
        )}
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        {MEMO_STAGES.map((stage) => (
          <section
            key={stage}
            aria-label={stage}
            onDragOver={(e) => {
              if (canEdit) {
                e.preventDefault()
                setDragOver(stage)
              }
            }}
            onDragLeave={() => setDragOver('')}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver('')
              move(e.dataTransfer.getData('text/plain'), stage)
            }}
            className={`min-w-0 rounded-xl border p-3 ${dragOver === stage ? 'border-accent bg-accent-soft' : 'border-line bg-subtle'}`}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{stage}</h2>
              <Badge>{memos.filter((row) => row.status === stage).length}</Badge>
            </div>
            <div className="min-h-28 space-y-3">
              {memos
                .filter((row) => row.status === stage && (!filter || row.status === filter))
                .map((row) => (
                  <Card
                    key={row.id}
                    draggable={canEdit}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', row.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    className="p-4"
                  >
                    <div className="mb-3 flex items-center justify-between text-xs text-muted">
                      <span>{row.id}</span>
                      {canEdit && <GripVertical className="h-4 w-4" aria-label="Drag memo card" />}
                    </div>
                    <button
                      className="rounded text-left text-sm font-semibold hover:text-accent"
                      onClick={() => setSelected(row.id)}
                    >
                      {row.title}
                    </button>
                    <p className="mt-3 text-xs text-muted">{row.owner}</p>
                    <p className="mt-1 text-xs text-muted">Review by {formatDate(row.date)}</p>
                    {canEdit && (
                      <label className="mt-4 block text-xs text-muted">
                        Move to
                        <select
                          className="ui-field mt-1"
                          value={row.status}
                          onChange={(e) => move(row.id, e.target.value)}
                        >
                          {MEMO_STAGES.map((status) => (
                            <option
                              key={status}
                              disabled={status !== row.status && !allowed(row, status)}
                            >
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </Card>
                ))}
              {!memos.some((row) => row.status === stage && (!filter || row.status === filter)) && (
                <p className="rounded-lg border border-dashed border-line p-5 text-center text-xs text-muted">
                  No memos in this stage.
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
      <RecordPanel
        record={memos.find((row) => row.id === (params.get('record') || selected))}
        onClose={closeRecord}
      />
      <DemoRecordForm
        module="memos"
        open={canEditDemo(user?.role) && (createOpen || params.has('new'))}
        onClose={closeCreate}
      />
    </div>
  )
}
