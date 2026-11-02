import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Download, FilePlus2, Paperclip, Pencil, RefreshCw } from 'lucide-react'
import api from '../lib/api'
import { useWorkflow, downloadFile, errorMessage, statusLabel, statusTone } from '../contexts/WorkflowContext'
import { useAuth } from '../contexts/AuthContext'
import { formatDate, todayKey } from '../lib/dates'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import Dialog from '../components/ui/Dialog'
import RecordForm, { Field } from '../components/workflow/RecordForm'
import { WorkflowError } from './WorkflowPage'

const LABELS = { submit: 'Submit request', approve: 'Approve', reject: 'Reject', request_changes: 'Request changes', cancel: 'Cancel request', archive: 'Archive', restore: 'Restore', renew: 'Start next renewal', create_po: 'Create purchase order', create_payment_advice: 'Create payment advice', create_reimbursement: 'Create reimbursement', distribute: 'Distribute memo', acknowledge: 'Acknowledge memo', follow_up: 'Remind outstanding recipients' }

function Value({ field, value, people, records }) {
  if (value == null || value === '') return <span className="text-muted">—</span>
  if (field.type === 'items') return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-muted"><tr>{['Item', 'Qty', 'Size', 'Unit price', 'Amount'].map((label) => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{value.map((item, i) => <tr key={i} className="border-t border-line"><td className="p-2">{item.description}</td><td className="p-2">{item.quantity}</td><td className="p-2">{item.size || '—'}</td><td className="whitespace-nowrap p-2">RM {Number(item.unit_price).toFixed(2)}</td><td className="whitespace-nowrap p-2">RM {(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</td></tr>)}</tbody><tfoot><tr className="border-t border-line"><td colSpan={4} className="p-2 font-semibold">Total</td><td className="whitespace-nowrap p-2 font-semibold">RM {value.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0).toFixed(2)}</td></tr></tfoot></table></div>
  if (field.type === 'users') return value.map((id) => people.find((person) => person.id === id)?.full_name || id).join(', ')
  if (field.type === 'supplier') return <Link className="ui-link" to={`/records/${value}`}>{records.find((r) => r.id === value)?.title || `Supplier #${value}`}</Link>
  if (field.type === 'checkbox') return value ? 'Yes' : 'No'
  if (field.type === 'money') return `RM ${Number(value).toFixed(2)}`
  if (field.type === 'url' && /^https?:\/\//.test(value)) return <a href={value} target="_blank" rel="noreferrer" className="ui-link break-all">Open provider portal</a>
  return <span className="whitespace-pre-wrap break-words">{String(value)}</span>
}

export default function WorkflowRecord() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { catalog, people, records, refresh } = useWorkflow()
  const { user } = useAuth()
  const [record, setRecord] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [related, setRelated] = useState(false)
  const [tab, setTab] = useState('details')
  const [action, setAction] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayKey())
  const [newExpiry, setNewExpiry] = useState('')
  const [documentKey, setDocumentKey] = useState('')
  const [verification, setVerification] = useState(null)
  const [verificationResult, setVerificationResult] = useState('verified')
  const [verificationNotes, setVerificationNotes] = useState('')
  const load = useCallback(async () => {
    try { const result = await api.get(`/workflow/records/${id}`); setRecord(result.data); setError('') }
    catch (err) { setError(errorMessage(err)) }
  }, [id])
  useEffect(() => { setRecord(null); setTab('details'); load() }, [load])
  const definition = catalog.processes[record?.kind]
  const current = record?.steps[record?.step_index]
  const isOperator = ['system_administrator', 'hr_admin'].includes(user?.role)
  const isFinance = ['system_administrator', 'finance'].includes(user?.role)
  const canUpload = record && !record.archived && !['pending_approval', 'rejected', 'cancelled'].includes(record.status) && (isOperator || record.owner_id === user?.id || (isFinance && record.status === 'finance_queue'))
  const canVerify = record && !record.archived && !['pending_approval', 'completed', 'rejected', 'cancelled'].includes(record.status) && (isOperator || (isFinance && record.status === 'finance_queue'))
  const actionLabel = (name) => name === 'advance' ? current?.kind === 'approval' ? 'Request approval' : current?.kind === 'finance' ? 'Record payment' : 'Complete current step' : LABELS[name]
  async function perform(event) {
    event?.preventDefault(); setBusy(true); setError('')
    try {
      const result = await api.post(`/workflow/records/${id}/actions`, { revision: record.revision, action, notes, payment_reference: paymentRef, payment_date: current?.kind === 'finance' ? paymentDate || null : null, new_expiry_date: newExpiry || null })
      setAction(''); setNotes(''); setNewExpiry(''); setPaymentRef(''); await refresh()
      if (String(result.data.id) !== id) navigate(`/records/${result.data.id}`)
      else setRecord(result.data)
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  async function upload(event) {
    event.preventDefault(); setBusy(true); setError('')
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    form.set('revision', record.revision)
    try {
      const response = await api.post(`/workflow/records/${id}/files`, form, { headers: { 'Content-Type': undefined } })
      setRecord(response.data); formElement.reset(); setDocumentKey(''); await refresh()
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  async function verify(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const response = await api.post(`/workflow/files/${verification.id}/verify`, { result: verificationResult, notes: verificationNotes })
      setRecord(response.data); setVerification(null); setVerificationNotes(''); await refresh()
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  async function download(path, filename) {
    try { await downloadFile(path, filename) } catch (err) { setError(errorMessage(err)) }
  }
  if (!record || !definition) return <div className="space-y-4"><Link to="/workflows" className="ui-link">Back to workflows</Link><WorkflowError error={error} retry={load} /><p role="status" className="text-muted">{!error && 'Loading request…'}</p></div>
  const approvedFiles = new Set(record.history.filter((event) => event.action === 'Submitted for approval').flatMap((e) => e.snapshot.file_ids || []))
  const quotes = record.linked_records.filter((r) => r.kind === 'quotation')
  return <div className="space-y-6">
    <Link to="/workflows" className="ui-link inline-flex items-center gap-2 text-sm"><ArrowLeft className="h-4 w-4" /> Workflow directory</Link>
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><div className="mb-3 flex flex-wrap items-center gap-2"><Badge variant={statusTone(record.status)}>{statusLabel(record.status)}</Badge>{record.archived && <Badge>Archived</Badge>}<span className="text-xs text-muted">{record.number}</span></div><h1 className="break-words text-3xl font-bold">{record.title}</h1><p className="mt-2 text-sm text-muted">{definition.title} · {record.company} · {record.owner_name}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={load} aria-label="Refresh request"><RefreshCw className="h-4 w-4" /></Button>{record.can_edit && <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>}<Button variant="outline" size="sm" onClick={() => download(`/workflow/records/${id}/pdf`, `${record.number}.pdf`)}><Download className="h-4 w-4" /> PDF</Button></div>
    </div>
    <WorkflowError error={!action && !verification ? error : ''} retry={load} />
    <Card className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-accent">{record.status === 'completed' ? 'Completed' : 'Next step'}</p><h2 className="mt-2 text-lg font-semibold">{current?.label || 'All workflow steps completed'}</h2><p className="mt-2 text-xs text-muted">Step {Math.min(record.step_index + 1, record.steps.length)} of {record.steps.length} · Cycle {record.cycle}{record.due_date ? ` · Due / expiry ${formatDate(record.due_date)}` : ''}</p></div>{record.reminder_date && <Badge>Remind on {formatDate(record.reminder_date)}</Badge>}</div>
      {current?.kind === 'approval' && !record.rule?.confirmed && <p className="mt-4 text-sm text-[var(--app-warning)]">The approval rule needs company confirmation. <Link className="ui-link" to="/approvals">Open approval rules</Link></p>}
      {record.status === 'pending_approval' && <p className="mt-4 text-sm text-muted">Waiting for {record.approvals.find((a) => a.cycle === record.cycle && a.status === 'pending')?.approver}. Submitted documents are locked for review.</p>}
      <div className="mt-5 flex flex-wrap gap-2">{record.actions.map((name) => <Button key={name} size="sm" variant={['advance', 'submit', 'approve', 'distribute', 'acknowledge'].includes(name) ? 'teal' : 'outline'} disabled={busy} onClick={() => { setError(''); setNotes(''); setAction(name) }}>{actionLabel(name)}</Button>)}</div>
    </Card>
    <div className="flex flex-wrap gap-2 border-b border-line pb-3">{['details', 'workflow', 'documents', 'approvals', 'history', 'linked records', ...(record.kind === 'memo' ? ['acknowledgements'] : [])].map((name) => <Button key={name} variant={tab === name ? 'teal' : 'ghost'} size="sm" onClick={() => setTab(name)}>{statusLabel(name)}{name === 'documents' ? ` (${record.files.length})` : ''}</Button>)}</div>
    {tab === 'details' && <Card className="space-y-6 p-5">{definition.fields.map((field) => <div key={field.key}><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{field.label}</h3><div className="text-sm"><Value field={field} value={record.data[field.key]} people={people} records={records} /></div></div>)}{record.data.payment_reference && <div className="rounded-lg bg-subtle p-4 text-sm"><Badge variant="success">Payment recorded</Badge><p className="mt-2">Reference: {record.data.payment_reference} · {record.data.payment_date}</p></div>}</Card>}
    {tab === 'workflow' && <Card className="p-5"><ol className="space-y-0">{record.steps.map((step, index) => <li key={index} className={`flex gap-4 border-l-2 py-3 pl-4 ${index < record.step_index ? 'border-accent' : 'border-line'}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${index <= record.step_index ? 'bg-accent-soft text-accent' : 'bg-subtle text-muted'}`}>{index < record.step_index ? <Check className="h-4 w-4" /> : index + 1}</span><span className="pt-1 text-sm"><span className={index === record.step_index ? 'font-semibold' : ''}>{step.label}</span>{step.kind !== 'task' && <Badge className="ml-2">{step.kind}</Badge>}</span></li>)}</ol></Card>}
    {tab === 'documents' && <div className="space-y-4">
      <Card className="p-5"><h2 className="font-semibold">Supporting documents & versions</h2>{record.rule?.required_documents?.length > 0 && <p className="mt-2 text-sm text-muted">Required categories: {record.rule.required_documents.join(', ')}</p>}
        <div className="mt-4 divide-y divide-[var(--app-line)]">{record.files.map((file) => <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="break-words text-sm font-medium">{file.document_key} · v{file.version}</p><p className="mt-1 break-all text-xs text-muted">{file.filename} · {(file.size / 1024).toFixed(1)} KB</p><div className="mt-2 flex gap-2"><Badge variant={file.verification === 'verified' ? 'success' : 'warning'}>{statusLabel(file.verification)}</Badge>{approvedFiles.has(file.id) && <Badge>Submitted version</Badge>}</div>{file.verification_notes && <p className="mt-2 text-xs text-muted">{file.verified_by}: {file.verification_notes}</p>}</div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => download(`/workflow/files/${file.id}`, file.filename)}>Download</Button>{canVerify && <Button size="sm" variant="outline" onClick={() => { setVerification(file); setVerificationNotes(''); setVerificationResult('verified'); setError('') }}>Verify</Button>}</div></div>)}</div>{!record.files.length && <p className="mt-6 text-sm text-muted">No documents attached.</p>}
      </Card>
      {canUpload && <Card className="p-5"><h2 className="mb-4 flex items-center gap-2 font-semibold"><Paperclip className="h-4 w-4" /> Attach document</h2><form className="space-y-4" onSubmit={upload}>
        <Field label="Document category" hint="Use an existing category to upload the next version."><input name="document_key" className="ui-field" required value={documentKey} onChange={(e) => setDocumentKey(e.target.value)} maxLength={100} list="document-categories" /><datalist id="document-categories">{[...new Set(['Quotation', 'Invoice', 'Receipt', 'Payment evidence', 'Renewed policy', 'Renewed licence', ...record.files.map((f) => f.document_key), ...(record.rule?.required_documents || [])])].map((label) => <option key={label}>{label}</option>)}</datalist></Field>
        <Field label="File"><input type="file" name="file" required className="ui-field" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.csv,.txt" /></Field><Button variant="teal" type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Upload document'}</Button>
      </form></Card>}
    </div>}
    {tab === 'approvals' && <Card className="space-y-4 p-5"><h2 className="font-semibold">Approval history</h2>{record.approvals.map((item) => <div key={item.id} className="rounded-lg border border-line p-4"><div className="flex flex-wrap justify-between gap-2"><span className="text-sm font-medium">Cycle {item.cycle} · Level {item.position + 1} · {item.approver}</span><Badge variant={item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'danger' : 'warning'}>{statusLabel(item.status)}</Badge></div>{item.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{item.notes}</p>}<p className="mt-2 text-xs text-muted">{item.decided_at?.replace('T', ' ') || 'Awaiting decision'}</p></div>)}{!record.approvals.length && <p className="text-sm text-muted">No approval has been requested.</p>}</Card>}
    {tab === 'history' && <Card className="p-5"><h2 className="mb-5 font-semibold">Audit & revision history</h2><ol className="space-y-4">{[...record.history].reverse().map((event) => <li key={event.id} className="border-l-2 border-accent pl-4"><p className="text-sm font-medium">{event.action}{event.snapshot.label ? ` · ${event.snapshot.label}` : ''}</p><p className="mt-1 text-xs text-muted">{event.actor} · {event.at?.replace('T', ' ')} MYT</p>{event.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{event.notes}</p>}{event.action === 'Details revised' && <details className="mt-2 text-xs text-muted"><summary className="cursor-pointer">Saved revision</summary><pre className="mt-2 max-w-full overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(event.snapshot.data, null, 2)}</pre></details>}</li>)}</ol></Card>}
    {tab === 'linked records' && <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Related requests and quotation comparison</h2>{isOperator && <Button size="sm" variant="outline" onClick={() => setRelated(true)}><FilePlus2 className="h-4 w-4" /> Add related record</Button>}</div>{record.linked_records.map((r) => <Link key={r.id} to={`/records/${r.id}`} className="block rounded-xl border border-line bg-surface p-4 hover:bg-subtle"><p className="font-medium">{r.title}</p><p className="mt-2 text-xs text-muted">{r.number} · {catalog.processes[r.kind]?.title} · {statusLabel(r.status)}</p></Link>)}{!record.linked_records.length && <p className="text-sm text-muted">No related requests yet. Link quotations, POs and payment records to keep them together.</p>}{quotes.length > 0 && <Card className="overflow-x-auto p-4"><table className="w-full text-left text-sm"><caption className="mb-3 text-left font-semibold">Quotation comparison</caption><thead><tr>{['Quotation', 'Supplier', 'Total (RM)', 'Validity', 'Terms'].map((s) => <th key={s} className="p-2">{s}</th>)}</tr></thead><tbody>{quotes.map((r) => <tr key={r.id} className="border-t border-line"><td className="p-2"><Link className="ui-link" to={`/records/${r.id}`}>{r.number}</Link></td><td className="p-2">{records.find((s) => s.id === r.data.supplier_id)?.title || '—'}</td><td className="p-2">{(r.data.items || []).reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0).toFixed(2)}</td><td className="p-2">{r.data.valid_until || '—'}</td><td className="p-2">{r.data.terms || '—'}</td></tr>)}</tbody></table></Card>}</div>}
    {tab === 'acknowledgements' && <Card className="space-y-3 p-5"><h2 className="font-semibold">Memo recipients</h2>{record.acknowledgements.map((item) => <div key={item.user_id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-line p-3 text-sm"><span>{item.name}</span><Badge variant={item.acknowledged_at ? 'success' : 'warning'}>{item.acknowledged_at ? `Acknowledged ${item.acknowledged_at.slice(0, 10)}` : 'Outstanding'}</Badge></div>)}{!record.acknowledgements.length && <p className="text-sm text-muted">Recipients will appear after the memo is distributed.</p>}</Card>}
    {editing && <RecordForm open record={record} onClose={() => setEditing(false)} onSaved={setRecord} />}
    {related && <RecordForm open onClose={() => setRelated(false)} initialKind="quotation" prefill={{ company: record.company, parent_id: record.id }} />}
    <Dialog open={!!action} onClose={() => { if (!busy) { setAction(''); setError('') } }} title={actionLabel(action) || 'Workflow action'}><form onSubmit={perform} className="space-y-4">
      {error && <p role="alert" className="text-sm text-[var(--app-danger)]">{error}</p>}
      <p className="text-sm text-muted">{record.number} · {action === 'advance' ? current?.label : actionLabel(action)}</p>
      <Field label={['reject', 'request_changes', 'cancel'].includes(action) ? 'Reason (required)' : 'Step notes / verification result'}><textarea data-autofocus className="ui-field" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} required={['reject', 'request_changes', 'cancel'].includes(action) || (action === 'advance' && current?.kind === 'verify')} maxLength={4000} /></Field>
      {action === 'advance' && current?.kind === 'finance' && <><Field label="Payment reference"><input className="ui-field" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} required maxLength={180} /></Field><Field label="Payment date"><input className="ui-field" type="date" value={paymentDate} max={todayKey()} onChange={(e) => setPaymentDate(e.target.value)} required /></Field><p className="text-xs text-muted">Record the payment processed by Finance and attach its evidence in Documents.</p></>}
      {action === 'advance' && definition.renewable && <Field label={record.kind === 'aircon_maintenance' ? 'Next service date (when available)' : 'Renewed expiry date (when available)'}><input className="ui-field" type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} /></Field>}
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAction('')} disabled={busy}>Back</Button><Button type="submit" variant="teal" disabled={busy}>{busy ? 'Saving…' : actionLabel(action)}</Button></div>
    </form></Dialog>
    <Dialog open={!!verification} onClose={() => { if (!busy) setVerification(null) }} title="Verify supporting document"><form onSubmit={verify} className="space-y-4">{error && <p role="alert" className="text-sm text-[var(--app-danger)]">{error}</p>}<p className="text-sm">{verification?.document_key} · {verification?.filename}</p><Field label="Result"><select className="ui-field" value={verificationResult} onChange={(e) => setVerificationResult(e.target.value)}><option value="verified">Verified</option><option value="correction_required">Correction required</option></select></Field><Field label="Checks performed / corrections"><textarea data-autofocus className="ui-field" rows={4} required value={verificationNotes} onChange={(e) => setVerificationNotes(e.target.value)} maxLength={4000} placeholder="Company, amount, date, supporting details and duplicate checks…" /></Field><Button type="submit" variant="teal" disabled={busy}>{busy ? 'Saving…' : 'Save verification'}</Button></form></Dialog>
  </div>
}
