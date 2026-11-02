import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import api from '../../lib/api'
import { useWorkflow, errorMessage } from '../../contexts/WorkflowContext'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import Dialog from '../ui/Dialog'

export default function NotificationCentre({ open, onClose }) {
  const { notifications, refresh } = useWorkflow()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const unread = notifications.filter((row) => !row.read)
  async function markAllRead() {
    setBusy(true)
    try { await api.post('/workflow/notifications/read'); await refresh(); setError('') }
    catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  return (
    <Dialog open={open} onClose={onClose} title="Notification centre" panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="info">{unread.length} unread</Badge>
        <Button size="sm" variant="ghost" disabled={!unread.length || busy} onClick={markAllRead}>
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </Button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-[var(--app-danger)]">{error}</p>}
      <ul className="mt-6 space-y-3">
        {notifications.map((row) => (
          <li key={row.id}>
            <button
              className={`w-full rounded-xl border p-4 text-left hover:bg-subtle ${row.read ? 'border-line' : 'border-accent bg-accent-soft'}`}
              onClick={() => {
                onClose()
                navigate(`/records/${row.record_id}`)
              }}
            >
              <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                <Bell className="h-3 w-3" />
                {row.type === 'reminder' ? 'Due-date reminder' : 'Workflow update'}
              </div>
              <p className="break-words text-sm font-semibold">{row.message}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                {row.date && <Badge variant={row.days < 0 ? 'danger' : 'warning'}>{row.date}</Badge>}
                <span className="text-xs text-muted">
                  {row.read ? 'Read' : 'Unread'}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {notifications.length === 0 && (
        <p className="py-10 text-center text-muted">You’re all caught up.</p>
      )}
    </Dialog>
  )
}
