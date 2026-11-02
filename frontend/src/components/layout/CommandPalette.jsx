import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Search } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useWorkflow } from '../../contexts/WorkflowContext'
import { NAV } from './Sidebar'
import Dialog from '../ui/Dialog'

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { user } = useAuth()
  const { records, catalog } = useWorkflow()
  const navigate = useNavigate()
  const isAdmin = ['system_administrator', 'admin'].includes(user?.role)
  useEffect(() => {
    const show = () => {
      setQuery('')
      setOpen(true)
    }
    const shortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        show()
      }
    }
    window.addEventListener('keydown', shortcut)
    window.addEventListener('nct:command', show)
    return () => {
      window.removeEventListener('keydown', shortcut)
      window.removeEventListener('nct:command', show)
    }
  }, [])
  const commands = [
    ...NAV.filter((item) => (!item.admin || isAdmin) && (!item.finance || ['system_administrator', 'hr_admin', 'finance'].includes(user?.role))).map((item) => ({
      title: item.label,
      to: item.to,
      type: 'Page',
    })),
    ...records
      .filter((row) => !row.archived)
      .map((row) => ({
        title: row.title,
        to: `/records/${row.id}`,
        type: `${catalog.processes[row.kind]?.title || 'Request'} · ${row.number}`,
      })),
  ]
    .filter((item) => `${item.title} ${item.type}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 10)
  function run(command) {
    setOpen(false)
    navigate(command.to)
  }
  function keyboard(event) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    if (['Home', 'End'].includes(event.key) && event.target.tagName === 'INPUT') return
    event.preventDefault()
    const elements = [...event.currentTarget.querySelectorAll('[data-command]')]
    const index = elements.indexOf(document.activeElement)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? elements.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + elements.length) % elements.length
    elements[next]?.focus()
  }
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Search workspace">
      <div onKeyDown={keyboard}>
        <label className="relative block">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted" />
          <span className="sr-only">Search pages and saved records</span>
          <input
            data-autofocus
            type="search"
            placeholder="Search pages and saved records…"
            className="ui-field pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && commands[0]) run(commands[0])
            }}
          />
        </label>
        <p className="my-3 text-xs text-muted" aria-live="polite">
          {commands.length} results · ↑ ↓ to navigate · Enter to open · Esc to close
        </p>
        <ul className="space-y-1">
          {commands.map((command) => (
            <li key={command.to}>
              <button
                data-command
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left hover:bg-subtle"
                onClick={() => run(command)}
              >
                <span className="min-w-0">
                  <span className="block break-words text-sm font-medium">{command.title}</span>
                  <span className="mt-1 block text-xs text-muted">{command.type}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
        {commands.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">No matching pages or records.</p>
        )}
      </div>
    </Dialog>
  )
}
