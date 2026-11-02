import { useState } from 'react'
import api from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { errorMessage } from '../../contexts/WorkflowContext'
import { todayKey } from '../../lib/dates'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { Field } from './RecordForm'

export default function VehicleActions({ record, onSaved }) {
  const { user } = useAuth()
  const [action, setAction] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const manager = ['system_administrator', 'hr_admin'].includes(user?.role)
  const approver = manager || user?.role === 'authorised_approver'
  const choices = []
  if (record.status === 'pending' && manager) choices.push(['driver', 'Record driver eligibility check'])
  if (record.status === 'pending' && approver && record.requested_by !== user?.id) choices.push(['approve', 'Approve booking'], ['reject', 'Reject booking'])
  if (record.status === 'approved' && !record.collection_recorded_at && manager) choices.push(['collection', 'Check out vehicle & keys'])
  if (record.status === 'approved' && record.collection_recorded_at && manager) choices.push(['return', 'Inspect return & close booking'])
  if (['pending', 'approved'].includes(record.status) && !record.collection_recorded_at && (approver || record.requested_by === user?.id)) choices.push(['cancel', 'Cancel booking'])
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('')
    const values = Object.fromEntries(new FormData(event.currentTarget))
    try {
      if (['driver', 'collection', 'return'].includes(action)) {
        await api.post(`/borrowing/${record.id}/inspection`, { stage: action, notes: values.notes,
          actual_return_date: values.actual_return_date || null, keys_returned: values.keys_returned === 'on', issues: values.issues || '' })
      } else await api.post(`/borrowing/${record.id}/action`, { action, notes: values.notes })
      setAction(''); await onSaved()
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  return <section className="space-y-4 border-t border-line pt-5"><h3 className="font-semibold">Driver check & vehicle handover</h3>
    <Badge variant={record.driver_verified_by ? 'success' : 'warning'}>{record.driver_verified_by ? 'Driver eligibility checked' : 'Driver eligibility check pending'}</Badge>
    {record.driver_eligibility_notes && <p className="text-sm text-muted">Driver verification: {record.driver_eligibility_notes}</p>}
    {record.collection_condition && <p className="text-sm text-muted">Check-out condition: {record.collection_condition}</p>}
    {record.return_condition && <p className="text-sm text-muted">Return condition: {record.return_condition} · Keys {record.keys_returned ? 'returned' : 'outstanding'}</p>}
    {record.issues && <p className="text-sm text-[var(--app-warning)]">Follow-up: {record.issues}</p>}
    {choices.length > 0 && <form className="space-y-4" onSubmit={save}><Field label="Next action"><select className="ui-field" value={action} onChange={(e) => { setAction(e.target.value); setError('') }} required><option value="">Choose action…</option>{choices.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>{action && <><Field label={action === 'driver' ? 'Eligibility checks against company requirements' : action === 'collection' ? 'Vehicle condition and keys handed over' : action === 'return' ? 'Return inspection and condition' : 'Decision / reason'}><textarea className="ui-field" name="notes" rows={3} required maxLength={4000} /></Field>{action === 'return' && <><Field label="Actual return date"><input className="ui-field" type="date" name="actual_return_date" required defaultValue={todayKey()} min={record.borrow_date} max={todayKey()} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="keys_returned" /> All vehicle keys returned</label><Field label="Damage, delay or key issues requiring follow-up"><textarea className="ui-field" name="issues" rows={3} maxLength={4000} /></Field><p className="text-xs text-muted">Outstanding keys or reported issues place the vehicle in maintenance until HR Admin resolves them.</p></>}<Button variant="teal" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Record action'}</Button></>}{error && <p role="alert" className="text-sm text-[var(--app-danger)]">{error}</p>}</form>}
  </section>
}
