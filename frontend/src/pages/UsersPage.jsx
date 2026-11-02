import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useWorkflow, errorMessage, statusLabel } from '../contexts/WorkflowContext'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Dialog from '../components/ui/Dialog'
import { Field } from '../components/workflow/RecordForm'
import { WorkflowError } from './WorkflowPage'

export default function UsersPage() {
  const { user } = useAuth()
  const { refresh } = useWorkflow()
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const admin = user?.role === 'system_administrator'
  async function load() { try { const response = await api.get('/users'); setUsers(response.data); if (admin) { const result = await api.get('/users/roles'); setRoles(result.data) } setError('') } catch (err) { setError(errorMessage(err)) } }
  useEffect(() => { load() }, [admin])
  async function create(e) { e.preventDefault(); setBusy(true); try { await api.post('/users', Object.fromEntries(new FormData(e.currentTarget))); setOpen(false); await load(); await refresh() } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) } }
  async function update(person, data) { setBusy(true); try { await api.put(`/users/${person.id}`, data); await load(); await refresh() } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) } }
  return <div className="space-y-6"><div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-3xl font-bold">User management</h1><p className="mt-2 text-sm text-muted">Maintain requestors, HR Admin, Finance and authorised approvers.</p></div>{admin && <Button variant="teal" onClick={() => { setOpen(true); setError('') }}>Add user</Button>}</div>{!open && <WorkflowError error={error} retry={load} />}<div className="overflow-x-auto rounded-xl border border-line bg-surface"><table className="w-full text-left text-sm"><thead className="bg-subtle text-xs text-muted"><tr>{['User', 'Email', 'Role', 'Status', 'Access'].map((label) => <th className="p-4" key={label}>{label}</th>)}</tr></thead><tbody>{users.map((person) => <tr key={person.id} className="border-t border-line"><td className="p-4 font-medium">{person.full_name}</td><td className="p-4">{person.email}</td><td className="p-4">{admin && person.id !== user.id ? <select aria-label={`Role for ${person.full_name}`} className="ui-field min-w-44" value={person.role_name} disabled={busy} onChange={(e) => update(person, { role_name: e.target.value })}>{roles.map((role) => <option key={role.name} value={role.name}>{statusLabel(role.name)}</option>)}</select> : statusLabel(person.role_name)}</td><td className="p-4"><Badge variant={person.is_active ? 'success' : 'default'}>{person.is_active ? 'Active' : 'Inactive'}</Badge></td><td className="p-4">{admin && person.id !== user.id && <Button variant="outline" size="sm" disabled={busy} onClick={() => update(person, { is_active: !person.is_active })}>{person.is_active ? 'Deactivate' : 'Reactivate'}</Button>}</td></tr>)}</tbody></table></div><Dialog open={open} onClose={() => setOpen(false)} title="Add user"><form className="space-y-4" onSubmit={create}>{error && <p role="alert" className="text-sm text-[var(--app-danger)]">{error}</p>}<Field label="Full name"><input name="full_name" className="ui-field" maxLength={255} required /></Field><Field label="Email"><input name="email" className="ui-field" type="email" maxLength={255} required /></Field><Field label="Initial password"><input name="password" className="ui-field" type="password" minLength={6} required autoComplete="new-password" /></Field><Field label="Role"><select className="ui-field" name="role_name" required>{roles.map((role) => <option key={role.name} value={role.name}>{statusLabel(role.name)}</option>)}</select></Field><Button type="submit" variant="teal" disabled={busy}>{busy ? 'Saving…' : 'Create user'}</Button></form></Dialog></div>
}
