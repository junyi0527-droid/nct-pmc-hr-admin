import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownUp, Plus, Shirt } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { errorMessage } from '../contexts/WorkflowContext'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import Dialog from '../components/ui/Dialog'
import RecordForm, { Field } from '../components/workflow/RecordForm'
import WorkflowPage, { WorkflowError } from './WorkflowPage'

export default function InventoryPage() {
  const { user } = useAuth()
  const allowed = ['system_administrator', 'hr_admin'].includes(user?.role)
  const [params] = useSearchParams()
  const [view, setView] = useState(allowed && !params.has('type') ? 'stock' : 'requests')
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const [reorder, setReorder] = useState(null)
  const [search, setSearch] = useState('')
  async function load() {
    try { const response = await api.get('/registers/inventory'); setItems(response.data); setError('') }
    catch (err) { setError(errorMessage(err)) }
  }
  useEffect(() => { if (allowed) load() }, [allowed])
  async function select(item) {
    setSelected(item); setHistory([]); setError('')
    try { const response = await api.get(`/registers/inventory/${item.id}/movements`); setHistory(response.data) }
    catch (err) { setError(errorMessage(err)) }
  }
  async function create(event) {
    event.preventDefault(); setBusy(true); setError('')
    const body = Object.fromEntries(new FormData(event.currentTarget)); body.reorder_level = Number(body.reorder_level)
    try { await api.post('/registers/inventory', body); setCreating(false); await load() }
    catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  async function move(event) {
    event.preventDefault(); setBusy(true); setError('')
    const form = event.currentTarget
    const body = Object.fromEntries(new FormData(form))
    body.quantity = Number(body.quantity); body.record_id = body.record_id ? Number(body.record_id) : null
    body.revision = selected.revision; body.idempotency_key = crypto.randomUUID()
    try { const response = await api.post(`/registers/inventory/${selected.id}/movements`, body); form.reset(); await select(response.data); await load() }
    catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  const filtered = items.filter((i) => `${i.name} ${i.sku} ${i.size} ${i.company} ${i.category}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="space-y-6">
    <div className="flex flex-wrap gap-2 border-b border-line pb-3">{allowed && <Button variant={view === 'stock' ? 'teal' : 'ghost'} size="sm" onClick={() => setView('stock')}>Stock & equipment register</Button>}<Button variant={view === 'requests' ? 'teal' : 'ghost'} size="sm" onClick={() => setView('requests')}>Uniform requests & replenishment</Button></div>
    {view === 'requests' ? <WorkflowPage group="inventory" /> : <>
      <div className="flex flex-wrap justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">Stock register</p><h1 className="text-3xl font-bold">Uniforms, stationery & equipment</h1><p className="mt-2 text-sm text-muted">Keep each size and design under its own SKU. Record receipts, issues and distributions.</p></div><Button variant="teal" onClick={() => { setCreating(true); setError('') }}><Plus className="h-4 w-4" /> Add item</Button></div>
      {!creating && !selected && <WorkflowError error={error} retry={load} />}
      {items.some((item) => item.low_stock) && <Card className="p-4"><p className="text-sm font-semibold text-[var(--app-warning)]">{items.filter((item) => item.low_stock).length} items at or below their reorder level</p><p className="mt-1 text-xs text-muted">Open an item to create a replenishment request.</p></Card>}
      <input aria-label="Search stock" className="ui-field" placeholder="Search SKU, size, category or company…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="overflow-x-auto rounded-xl border border-line bg-surface"><table className="w-full text-left text-sm"><thead className="bg-subtle text-xs text-muted"><tr>{['Item / SKU', 'Company', 'Type / size', 'Location', 'Balance', 'Action'].map((s) => <th className="px-4 py-3" key={s}>{s}</th>)}</tr></thead><tbody>{filtered.map((item) => <tr key={item.id} className="border-t border-line"><td className="px-4 py-4"><p className="font-semibold">{item.name}</p><p className="mt-1 text-xs text-muted">{item.sku} · {item.design} · {item.material}</p></td><td className="px-4 py-4">{item.company}</td><td className="px-4 py-4">{item.category} {item.size && `· ${item.size}`}</td><td className="px-4 py-4">{item.location || '—'}</td><td className="px-4 py-4"><Badge variant={item.low_stock ? 'warning' : 'success'}>{item.quantity} in stock</Badge><p className="mt-1 text-xs text-muted">Reorder at {item.reorder_level}</p></td><td className="px-4 py-4"><Button variant="outline" size="sm" onClick={() => select(item)}><ArrowDownUp className="h-4 w-4" /> Movements</Button></td></tr>)}</tbody></table>{!filtered.length && <p className="p-12 text-center text-sm text-muted">No stock items yet. Add an item, then record its opening receipt.</p>}</div>
    </>}
    <Dialog open={creating} onClose={() => setCreating(false)} title="Add stock / equipment item"><form onSubmit={create} className="space-y-4">{error && <p role="alert" className="text-sm text-[var(--app-danger)]">{error}</p>}{[['company', 'Company'], ['sku', 'SKU (unique per company and size)'], ['name', 'Item name']].map(([name, label]) => <Field key={name} label={label}><input className="ui-field" name={name} required maxLength={name === 'sku' ? 80 : 180} /></Field>)}<Field label="Category"><select name="category" className="ui-field"><option>Uniform</option><option>Stationery</option><option>Equipment</option></select></Field>{[['size', 'Size'], ['design', 'Design / style'], ['material', 'Material'], ['location', 'Storage / assigned location']].map(([name, label]) => <Field key={name} label={label}><input className="ui-field" name={name} maxLength={name === 'size' ? 40 : 180} /></Field>)}<Field label="Low stock threshold"><input className="ui-field" name="reorder_level" type="number" min="0" max="1000000" defaultValue="5" required /></Field><Button type="submit" variant="teal" disabled={busy}>{busy ? 'Saving…' : 'Create item'}</Button></form></Dialog>
    <Dialog open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.name} · ${selected.sku}` : 'Stock movements'} panel>{selected && <div className="space-y-5"><div className="flex flex-wrap justify-between gap-2"><Badge variant={selected.low_stock ? 'warning' : 'success'}>{selected.quantity} available</Badge><Button size="sm" variant="outline" onClick={() => { setReorder(selected); setSelected(null) }}>Create reorder request</Button></div>{error && <p role="alert" className="text-sm text-[var(--app-danger)]">{error}</p>}<form className="space-y-4" onSubmit={move}><Field label="Movement"><select name="movement_type" className="ui-field">{['Receipt', 'Distribution', 'Return', 'Adjustment in', 'Adjustment out'].map((s) => <option key={s}>{s}</option>)}</select></Field><div className="grid grid-cols-2 gap-3"><Field label="Quantity"><input className="ui-field" name="quantity" type="number" min="1" max="1000000" required /></Field><Field label="Source request ID"><input className="ui-field" name="record_id" type="number" min="1" /></Field></div><Field label="Employee / recipient"><input className="ui-field" name="recipient" maxLength={180} /></Field><Field label="Receipt, delivery or distribution notes"><textarea className="ui-field" name="notes" rows={3} required maxLength={4000} /></Field><Button variant="teal" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Record movement'}</Button></form><h3 className="font-semibold">Stock movement history</h3><div className="space-y-3">{history.map((entry) => <div className="rounded-lg border border-line p-3 text-sm" key={entry.id}><div className="flex justify-between gap-2"><span className="font-medium">{entry.movement_type} · {entry.delta > 0 ? '+' : ''}{entry.delta}</span><span>Balance {entry.balance}</span></div><p className="mt-1 text-xs text-muted">{entry.actor} · {entry.created_at.replace('T', ' ')} MYT</p><p className="mt-2">{entry.recipient} {entry.notes}</p>{entry.record_id && <Link className="ui-link mt-2 block text-xs" to={`/records/${entry.record_id}`}>Source request</Link>}</div>)}</div></div>}</Dialog>
    {reorder && <RecordForm open onClose={() => setReorder(null)} initialKind={reorder.category === 'Uniform' ? 'uniform_replenishment' : reorder.category === 'Equipment' ? 'equipment_purchase' : 'stationery_purchase'} prefill={{ title: `Replenish ${reorder.name} · ${reorder.size || reorder.sku}`, company: reorder.company, data: { inventory_item_id: reorder.id, purpose: `Stock ${reorder.quantity}; reorder level ${reorder.reorder_level}`, items: [{ description: `${reorder.name} (${reorder.sku})`, size: reorder.size, quantity: String(Math.max(1, reorder.reorder_level * 2 - reorder.quantity)), unit_price: '0.00' }] } }} />}
  </div>
}
