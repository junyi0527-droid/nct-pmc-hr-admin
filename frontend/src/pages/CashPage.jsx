import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useWorkflow, errorMessage } from '../contexts/WorkflowContext'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Dialog from '../components/ui/Dialog'
import { Field } from '../components/workflow/RecordForm'
import WorkflowPage, { WorkflowError } from './WorkflowPage'

export default function CashPage() {
  const { people } = useWorkflow()
  const { user } = useAuth()
  const finance = ['system_administrator', 'finance'].includes(user?.role)
  const [view, setView] = useState('requests')
  const [accounts, setAccounts] = useState([])
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState(null)
  const [entries, setEntries] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function load() { try { const response = await api.get('/registers/cash'); setAccounts(response.data); setError('') } catch (err) { setError(errorMessage(err)) } }
  useEffect(() => { load() }, [])
  async function select(account) { setSelected(account); setError(''); try { const r = await api.get(`/registers/cash/${account.id}/entries`); setEntries(r.data) } catch (err) { setError(errorMessage(err)) } }
  async function create(e) {
    e.preventDefault(); setBusy(true); const body = Object.fromEntries(new FormData(e.currentTarget)); body.custodian_id = Number(body.custodian_id)
    try { await api.post('/registers/cash', body); setCreating(false); await load() } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  async function add(e) {
    e.preventDefault(); setBusy(true); const form = e.currentTarget
    const body = Object.fromEntries(new FormData(form)); body.record_id = body.record_id ? Number(body.record_id) : null
    body.revision = selected.revision; body.idempotency_key = crypto.randomUUID()
    try { const response = await api.post(`/registers/cash/${selected.id}/entries`, body); form.reset(); await select(response.data); await load() } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }
  return <div className="space-y-6"><div className="flex flex-wrap gap-2 border-b border-line pb-3"><Button size="sm" variant={view === 'requests' ? 'teal' : 'ghost'} onClick={() => setView('requests')}>Petty cash & reimbursement requests</Button><Button size="sm" variant={view === 'ledger' ? 'teal' : 'ghost'} onClick={() => setView('ledger')}>Cash accounts & ledger</Button></div>
    {view === 'requests' ? <WorkflowPage group="claims" /> : <><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold">Company petty cash ledgers</h1><p className="mt-2 text-sm text-muted">Track each company’s float, custodian, expenses and Finance replenishments.</p></div>{finance && <Button variant="teal" onClick={() => { setCreating(true); setError('') }}><Plus className="h-4 w-4" /> Add cash account</Button>}</div>{!creating && !selected && <WorkflowError error={error} retry={load} />}<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{accounts.map((account) => <Card key={account.id} className="p-5"><Badge>{account.company}</Badge><h2 className="mt-3 font-semibold">{account.name}</h2><p className="mt-2 text-xs text-muted">Custodian: {people.find((p) => p.id === account.custodian_id)?.full_name}</p><p className="my-4 text-3xl font-bold">RM {Number(account.balance).toFixed(2)}</p><Button variant="outline" size="sm" onClick={() => select(account)}>Open ledger</Button></Card>)}</div>{!accounts.length && <p className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted">No cash accounts available. Finance can create a company float and assign its custodian.</p>}</>}
    <Dialog open={creating} onClose={() => setCreating(false)} title="Add company petty cash account"><form className="space-y-4" onSubmit={create}>{error && <p role="alert" className="text-sm text-[var(--app-danger)]">{error}</p>}<Field label="Company"><input className="ui-field" name="company" required maxLength={180} /></Field><Field label="Account name"><input className="ui-field" name="name" required maxLength={180} /></Field><Field label="Cash custodian"><select className="ui-field" name="custodian_id" required><option value="">Choose…</option>{people.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></Field><Button variant="teal" type="submit" disabled={busy}>Create account</Button></form></Dialog>
    <Dialog open={!!selected} onClose={() => setSelected(null)} title={selected?.name || 'Cash ledger'} panel>{selected && <div className="space-y-5"><p className="text-sm text-muted">{selected.company} · Account #{selected.id}</p><p className="text-2xl font-bold">Available RM {Number(selected.balance).toFixed(2)}</p>{error && <p role="alert" className="text-sm text-[var(--app-danger)]">{error}</p>}<form className="space-y-4" onSubmit={add}><Field label="Entry type"><select className="ui-field" name="entry_type">{finance && <option>Float allocation</option>}<option>Expense</option>{finance && <option>Replenishment</option>}</select></Field><Field label="Amount (RM)"><input className="ui-field" name="amount" type="number" min="0.01" step="0.01" max="999999999" required /></Field><Field label="Receipt / payment reference"><input className="ui-field" name="reference" required maxLength={180} /></Field><Field label="Linked request ID"><input className="ui-field" name="record_id" type="number" min="1" /></Field><Field label="Notes"><textarea className="ui-field" name="notes" rows={2} maxLength={4000} /></Field><Button variant="teal" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Record ledger entry'}</Button></form><h3 className="font-semibold">Ledger history</h3><div className="space-y-3">{entries.map((entry) => <div key={entry.id} className="rounded-lg border border-line p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{entry.entry_type}</span><span>RM {Number(entry.amount).toFixed(2)}</span></div><p className="mt-2 text-xs text-muted">{entry.reference} · Balance RM {Number(entry.balance).toFixed(2)}</p><p className="mt-1 text-xs text-muted">{entry.actor} · {entry.created_at.replace('T', ' ')} MYT</p>{entry.notes && <p className="mt-2">{entry.notes}</p>}{entry.record_id && <Link className="ui-link mt-2 block text-xs" to={`/records/${entry.record_id}`}>Linked request</Link>}</div>)}</div></div>}</Dialog>
  </div>
}
