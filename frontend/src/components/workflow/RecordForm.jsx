import { Children, cloneElement, isValidElement, useId, useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import { useWorkflow, errorMessage, statusLabel } from '../../contexts/WorkflowContext'
import Button from '../ui/Button'
import Dialog from '../ui/Dialog'
import ConfirmDialog from '../ui/ConfirmDialog'

export function Field({ label, children, hint }) {
  const generatedId = useId()
  const nodes = Children.toArray(children)
  const control = nodes.find((child) => isValidElement(child) && ['input', 'textarea', 'select'].includes(child.type))
  const native = !!control
  const id = control?.props?.id || generatedId
  return <div className="min-w-0 text-sm font-medium" role={native ? undefined : 'group'} aria-labelledby={native ? undefined : `${generatedId}-label`}>
    {native ? <label htmlFor={id}>{label}</label> : <span id={`${generatedId}-label`}>{label}</span>}
    <div className="mt-1.5">{native ? nodes.map((child) => child === control ? cloneElement(child, { id, 'aria-describedby': hint ? `${generatedId}-hint` : undefined }) : child) : children}</div>
    {hint && <span id={`${generatedId}-hint`} className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
  </div>
}

export function ItemLines({ value = [], onChange }) {
  const change = (i, key, next) => onChange(value.map((row, index) => index === i ? { ...row, [key]: next } : row))
  const total = value.reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.unit_price) || 0), 0)
  return <div className="space-y-3">
    {value.map((row, i) => <fieldset key={i} className="rounded-lg border border-line p-3">
      <legend className="px-1 text-xs text-muted">Item {i + 1}</legend>
      <input aria-label={`Item ${i + 1} description`} className="ui-field" placeholder="Item description" value={row.description} onChange={(e) => change(i, 'description', e.target.value)} maxLength={300} />
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Field label="Quantity"><input className="ui-field" type="number" min="0.001" step="any" value={row.quantity} onChange={(e) => change(i, 'quantity', e.target.value)} /></Field>
        <Field label="Unit price (RM)"><input className="ui-field" type="number" min="0" step="0.01" value={row.unit_price} onChange={(e) => change(i, 'unit_price', e.target.value)} /></Field>
        <Field label="Size / variant"><input className="ui-field" value={row.size || ''} onChange={(e) => change(i, 'size', e.target.value)} maxLength={40} /></Field>
      </div>
      <Button variant="ghost" size="sm" className="mt-2" onClick={() => onChange(value.filter((_, index) => index !== i))}><Trash2 className="h-3 w-3" /> Remove item</Button>
    </fieldset>)}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button variant="outline" size="sm" onClick={() => onChange([...value, { description: '', quantity: '1', unit_price: '0.00', size: '' }])}><Plus className="h-3 w-3" /> Add item</Button>
      <span className="text-sm font-semibold">Total RM {total.toFixed(2)}</span>
    </div>
  </div>
}

export default function RecordForm({ open, onClose, initialKind, group, record, prefill = {}, onSaved }) {
  const { catalog, records, people, rules, refresh } = useWorkflow()
  const navigate = useNavigate()
  const kinds = Object.entries(catalog.processes).filter(([, p]) => !group || p.group === group)
  const [kind, setKind] = useState(record?.kind || initialKind || kinds[0]?.[0] || '')
  const [title, setTitle] = useState(record?.title || prefill.title || '')
  const [company, setCompany] = useState(record?.company || prefill.company || '')
  const [dueDate, setDueDate] = useState(record?.due_date || prefill.due_date || '')
  const [reminderDays, setReminderDays] = useState(record?.reminder_days ?? 90)
  const [parentId, setParentId] = useState(record?.parent_id || prefill.parent_id || '')
  const [search, setSearch] = useState('')
  const [linkMode, setLinkMode] = useState('none')

  const eligible = useMemo(() => {
    const term = search.toLowerCase().trim()
    return records.filter((r) => {
      if (r.company !== company) return false
      if (r.id === (record?.id ?? -1)) return false
      if (!term) return true
      return r.number.toLowerCase().includes(term) || r.title.toLowerCase().includes(term)
    })
  }, [records, company, record?.id, search])
  // Track what kind of reminder option user selected
  const [reminderOption, setReminderOption] = useState(() => {
    if (record?.reminder_date) return 'custom'
    if (record?.reminder_days === 0) return 'none'
    if ([1, 3, 7].includes(record?.reminder_days ?? 0)) return `${record.reminder_days}`
    return 'none'
  })
  const definition = catalog.processes[kind]
  const [data, setData] = useState(() => {
    const fields = new Set((catalog.processes[record?.kind || initialKind || kinds[0]?.[0]]?.fields || []).map((f) => f.key))
    return Object.fromEntries(Object.entries(record?.data || prefill.data || {}).filter(([key]) => fields.has(key)))
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [duplicateInvoiceWarning, setDuplicateInvoiceWarning] = useState('')
  const set = (key, value) => setData((previous) => ({ ...previous, [key]: value }))
  const initialValues = useRef(JSON.stringify({ kind, title, company, dueDate, reminderDays, parentId, data }))
  const [confirmClose, setConfirmClose] = useState(false)
  const dirty = JSON.stringify({ kind, title, company, dueDate, reminderDays, parentId, data }) !== initialValues.current

  function requestClose() {
    if (dirty) setConfirmClose(true)
    else onClose()
  }

  function discardChanges() {
    setConfirmClose(false)
    onClose()
  }

  // Automatically calculate reminder date when due date or option changes
  useEffect(() => {
    if (!dueDate) return
    if (reminderOption === 'custom') {
      setReminderDays(0)
      return
    }
    const days = parseInt(reminderOption) || 0
    setReminderDays(days)
  }, [dueDate, reminderOption])

  // Warn if the same invoice number already exists for this supplier/payee (possible duplicate payment)
  useEffect(() => {
    const invoice = data.invoice_number
    const payeeId = data.payee
    if (!invoice || !payeeId || !kind) {
      setDuplicateInvoiceWarning('')
      return
    }
    const duplicate = records.find(
      (r) => r.kind === kind
        && r.data.payee === payeeId
        && r.data.invoice_number === invoice
        && r.id !== (record?.id ?? -1)
    )
    setDuplicateInvoiceWarning(duplicate
      ? `Invoice ${invoice} already exists for this supplier / payee (${duplicate.number}). Possible duplicate payment.`
      : '')
  }, [data.invoice_number, data.payee, kind, record?.id])

  // Auto-fill Purpose / requirement from Utility + Billing period (e.g. "Electricity bill for Sep 2026")
  useEffect(() => {
    const utility = data.utility_type
    const period = data.billing_period
    if (!utility || !period || data.purpose) return
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const [year, month] = String(period).split('-')
    const monthName = monthNames[parseInt(month, 10) - 1] || month
    set('purpose', `${utility} bill for ${monthName} ${year}`)
  }, [data.utility_type, data.billing_period])

  async function save(event) {
    event.preventDefault(); setBusy(true); setError('')
    if (!title.trim()) {
      setError('Title is required. Scroll to the top of the form and enter a title.')
      setBusy(false)
      return
    }
    if (!company.trim()) {
      setError('Company is required. Scroll to the top of the form and enter the company name.')
      setBusy(false)
      return
    }
    if (data.payment_route === 'Payment on behalf / reimbursement' && !data.payee) {
      setError('Supplier / payee is required when Bill route is "Payment on behalf / reimbursement".')
      setBusy(false)
      return
    }
    try {
      const body = { title, due_date: dueDate || null, reminder_days: reminderDays ?? 90, data }
      const result = record
        ? await api.put(`/workflow/records/${record.id}`, { ...body, revision: record.revision })
        : await api.post('/workflow/records', { ...body, kind, company, parent_id: parentId ? Number(parentId) : null })
      await refresh(); onClose(); onSaved?.(result.data)
      if (!record) navigate(`/records/${result.data.id}`)
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  function formField(field) {
    const value = data[field.key]
    const common = { className: 'ui-field', value: value ?? '', onChange: (e) => set(field.key, e.target.value) }
    if (field.type === 'items') return <ItemLines value={value || []} onChange={(next) => set(field.key, next)} />
    if (field.type === 'textarea') return <textarea {...common} rows={4} maxLength={20000} />
    if (field.type === 'checkbox') return <input type="checkbox" checked={!!value} onChange={(e) => set(field.key, e.target.checked)} />
    if (field.type === 'users') return <div className="max-h-48 space-y-2 overflow-auto rounded-lg border border-line p-3">{people.map((person) => <label key={person.id} className="flex items-center gap-2 text-sm font-normal"><input type="checkbox" checked={(value || []).includes(person.id)} onChange={(e) => set(field.key, e.target.checked ? [...(value || []), person.id] : value.filter((id) => id !== person.id))} />{person.full_name}</label>)}</div>
    if (field.type === 'select') return <select {...common}><option value="">Choose…</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select>
    if (field.type === 'supplier') return <select {...common} onChange={(e) => set(field.key, e.target.value ? Number(e.target.value) : '')}><option value="">Choose a supplier / contractor…</option>{records.filter((r) => r.kind === 'supplier' && r.company === company).map((r) => <option key={r.id} value={r.id}>{r.title} · {r.number}</option>)}</select>
    if (field.key === 'billing_period') return <input {...common} type="month" />
    if (field.key === 'invoice_number') return (
      <div>
        <input {...common} />
        {duplicateInvoiceWarning && <p className="mt-1 block text-xs text-[var(--app-warning)]">{duplicateInvoiceWarning}</p>}
      </div>
    )
    return <input {...common} type={['money', 'integer'].includes(field.type) ? 'number' : field.type} min={field.type === 'money' ? '0' : '1'} step={field.type === 'money' ? '0.01' : field.type === 'integer' ? '1' : undefined} maxLength={500} />
  }
  return <>
    <Dialog open={open} onClose={requestClose} title={record ? `Edit ${record.number}` : 'New request / record'}>
    <form onSubmit={save} noValidate className="space-y-5">
      {error && <p role="alert" className="rounded-lg border border-line p-3 text-sm text-[var(--app-danger)]">{error}</p>}
      {!record && <Field label="Process"><select className="ui-field" value={kind} onChange={(e) => { setKind(e.target.value); setData({}) }}>{kinds.map(([key, p]) => <option key={key} value={key}>{p.number ? `${p.number}. ` : ''}{p.title}</option>)}</select></Field>}
      <Field label="Title"><input data-autofocus className="ui-field" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={255} /></Field>
      <Field label="Company"><input className="ui-field" value={company} disabled={!!record} required maxLength={180} list="workflow-companies" onChange={(e) => { setCompany(e.target.value); const rule = rules.find((r) => r.kind === kind && r.company === e.target.value) || rules.find((r) => r.kind === kind && r.company === '*'); if (rule) setReminderDays(rule.reminder_days) }} /><datalist id="workflow-companies">{[...new Set(records.map((r) => r.company))].map((name) => <option key={name}>{name}</option>)}</datalist></Field>
       {!record && (<Field label="Linked source request" hint="Link this request to an existing one or create it standalone.">
          <div className="flex flex-col gap-2">
            <div className="flex gap-4">
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="linkMode" value="none" checked={linkMode==='none'} onChange={()=>{setLinkMode('none'); setParentId(''); setSearch('')}} />
                Create without linking
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="linkMode" value="link" checked={linkMode==='link'} onChange={()=>setLinkMode('link')} />
                Link to an existing request
              </label>
            </div>
            {linkMode === 'link' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted">Search</span>
                  <input className="ui-field flex-1" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search by reference or title…" aria-label="Search linked requests" disabled={!company} />
                </div>
                {eligible.length === 0 ? (
                  <p className="text-sm text-muted">
                    {!company ? 'Enter a company first to see eligible requests in the same company.' : 'No eligible requests match your search in this company.'}
                  </p>
                ) : (
                  <div className="border border-line rounded-lg max-h-[260px] overflow-y-auto flex flex-col">
                    {eligible.map((r) => (
                      <button key={r.id} type="button" className="w-full text-left px-3 py-2.5 text-sm border-b border-b-transparent last:border-b-0 hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset" onClick={() => setParentId(String(r.id))}>
                        <div className="font-medium text-sm">{r.number}</div>
                        <div className="text-sm text-muted truncate" title={r.title}>{r.title}</div>
                        <div className="text-xs text-muted">{catalog.processes[r.kind]?.title || r.kind.replaceAll('_', ' ')} · {statusLabel(r.status)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Field>)}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={definition?.renewable ? 'Current expiry / next service' : 'Due / target date'}>
          <input className="ui-field" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Reminder option" hint="Select a period before the due date to receive a reminder.">
          <select className="ui-field" value={reminderOption} onChange={(e) => setReminderOption(e.target.value)}>
            <option value="none">No reminder</option>
            <option value="1">1 day before</option>
            <option value="3">3 days before</option>
            <option value="7">7 days before</option>
            <option value="custom">Custom date</option>
          </select>
        </Field>
      </div>
      {definition?.fields.map((field) => {
        let effectiveRequired = field.required
        if (field.key === 'payee') {
          effectiveRequired = field.required && data.payment_route === 'Payment on behalf / reimbursement'
        }
        return <Field key={field.key} label={`${field.label}${effectiveRequired ? ' *' : ''}`}>{formField(field)}</Field>
      })}
      <p className="text-xs text-muted">Save a draft, attach documents, then submit. Fields marked * are checked when you submit.</p>
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={requestClose} disabled={busy}>Cancel</Button><Button type="submit" variant="teal" disabled={busy}>{busy ? 'Saving…' : record ? 'Save changes' : 'Save draft'}</Button></div>
    </form>
    </Dialog>
    <ConfirmDialog open={confirmClose} onContinue={() => setConfirmClose(false)} onDiscard={discardChanges} />
  </>
}
