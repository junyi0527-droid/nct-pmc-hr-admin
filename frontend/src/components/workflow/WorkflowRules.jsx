import { useState } from 'react'
import api from '../../lib/api'
import { useWorkflow, errorMessage } from '../../contexts/WorkflowContext'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import { Field } from './RecordForm'

function ApprovalOrder({ ids, onChange, people, label = 'Approval order' }) {
  return <div><p className="mb-2 text-sm font-medium">{label}</p><ol className="space-y-2">{ids.map((id, index) => <li key={id} className="flex items-center justify-between gap-2 rounded-lg bg-subtle p-2 text-sm"><span>{index + 1}. {people.find((p) => p.id === id)?.full_name || id}</span><Button variant="ghost" size="sm" onClick={() => onChange(ids.filter((i) => i !== id))}>Remove</Button></li>)}</ol><select aria-label={`Add approver to ${label}`} className="ui-field mt-2" value="" onChange={(e) => { if (e.target.value) onChange([...ids, Number(e.target.value)]) }}><option value="">Add next approver…</option>{people.filter((p) => !ids.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.full_name} · {p.role.replaceAll('_', ' ')}</option>)}</select></div>
}

export default function WorkflowRules() {
  const { catalog, people, rules, refresh } = useWorkflow()
  const { user } = useAuth()
  const [kind, setKind] = useState('purchase_requisition')
  const [company, setCompany] = useState('*')
  const [ids, setIds] = useState([])
  const [tiers, setTiers] = useState([])
  const [required, setRequired] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [days, setDays] = useState(90)
  const [documents, setDocuments] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const admin = user?.role === 'system_administrator'
  function select(rule) {
    setKind(rule.kind); setCompany(rule.company); setIds(rule.approver_ids)
    setTiers(rule.approval_tiers || [])
    setRequired(rule.approval_required); setConfirmed(rule.confirmed); setDays(rule.reminder_days)
    setDocuments(rule.required_documents.join('\n')); setNotes(rule.notes); setMessage('')
  }
  async function save(e) {
    e.preventDefault(); setBusy(true); setMessage('')
    try {
      await api.put('/workflow/rules', { kind, company, approver_ids: ids, approval_required: required,
        confirmed, approval_tiers: required && catalog.processes[kind]?.fields.some((f) => ['money', 'items'].includes(f.type)) ? tiers : [], reminder_days: Number(days), required_documents: documents.split('\n').map((s) => s.trim()).filter(Boolean), notes })
      await refresh(); setMessage('Rule saved.')
    } catch (err) { setMessage(errorMessage(err)) }
    finally { setBusy(false) }
  }
  return <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
    <div className="space-y-4"><p className="text-sm text-muted">Company-specific rules take precedence over “*” rules. Confirm each process with HR / Finance and enter its actual approval order. A confirmed rule may explicitly state that approval is unnecessary.</p>
      {rules.map((r) => <button key={r.id} className="block w-full rounded-xl border border-line bg-surface p-4 text-left hover:bg-subtle" onClick={() => select(r)}><span className="text-sm font-semibold">{catalog.processes[r.kind]?.title} · {r.company}</span><div className="mt-2 flex flex-wrap gap-2"><Badge variant={r.confirmed ? 'success' : 'warning'}>{r.confirmed ? 'Confirmed' : 'To confirm'}</Badge><span className="text-xs text-muted">{r.approval_required ? `${r.approver_ids.length} approval level(s)` : 'Approval not required'}</span></div></button>)}
      {!rules.length && <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">No approval rules have been confirmed yet.</p>}
    </div>
    <Card className="p-5"><h2 className="mb-4 font-semibold">{admin ? 'Configure approval rule' : 'Rule details'}</h2>
      <form onSubmit={save} className="space-y-4"><fieldset disabled={!admin || busy} className="space-y-4">
        <Field label="Process"><select className="ui-field" value={kind} onChange={(e) => setKind(e.target.value)}>{Object.entries(catalog.processes).map(([key, p]) => <option key={key} value={key}>{p.title}</option>)}</select></Field>
        <Field label="Company" hint="Use * for a default rule; use the exact company name for an exception."><input className="ui-field" required value={company} onChange={(e) => setCompany(e.target.value)} maxLength={180} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Approval required</label>
        {required && <ApprovalOrder ids={ids} onChange={setIds} people={people} label="Default approval order" />}
        {required && catalog.processes[kind]?.fields.some((f) => ['money', 'items'].includes(f.type)) && <div className="space-y-3 rounded-lg border border-line p-3">
          <h3 className="text-sm font-semibold">Amount thresholds (optional)</h3>
          <p className="text-xs text-muted">The highest minimum at or below the request’s RM amount replaces the default chain. For purchasing, the amount is the sum of quantity × unit price.</p>
          {tiers.map((tier, index) => <div key={index} className="space-y-3 rounded-lg border border-line p-3">
            <Field label={`Threshold ${index + 1}: at or above (RM)`}><input className="ui-field" type="number" min="0.01" max="999999999" step="0.01" required value={tier.minimum_amount} onChange={(e) => setTiers(tiers.map((t, i) => i === index ? { ...t, minimum_amount: e.target.value } : t))} /></Field>
            <ApprovalOrder ids={tier.approver_ids} onChange={(next) => setTiers(tiers.map((t, i) => i === index ? { ...t, approver_ids: next } : t))} people={people} label={`Threshold ${index + 1} approval order`} />
            <Button variant="ghost" size="sm" onClick={() => setTiers(tiers.filter((_, i) => i !== index))}>Remove threshold</Button>
          </div>)}
          <Button variant="outline" size="sm" onClick={() => setTiers([...tiers, { minimum_amount: '', approver_ids: [] }])} disabled={tiers.length >= 20}>Add amount threshold</Button>
        </div>}
        <Field label="Reminder days"><input className="ui-field" type="number" min="0" max="730" required value={days} onChange={(e) => setDays(e.target.value)} /></Field>
        <Field label="Required document categories" hint="One category per line. Attachments use these same category names."><textarea className="ui-field" rows={3} value={documents} onChange={(e) => setDocuments(e.target.value)} placeholder={'Quotation\nInvoice'} /></Field>
        <Field label="SOP / HR and Finance confirmation reference"><textarea className="ui-field" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Confirmed by the responsible company representatives</label>
        {admin && <Button type="submit" variant="teal">{busy ? 'Saving…' : 'Save rule'}</Button>}
      </fieldset>{!admin && <p className="text-sm text-muted">A system administrator can update these rules.</p>}{message && <p role="status" className="text-sm">{message}</p>}</form>
    </Card>
  </div>
}
