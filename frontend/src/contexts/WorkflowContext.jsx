import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from './AuthContext'

const WorkflowContext = createContext(null)

export function errorMessage(error) {
  const detail = error.response?.data?.detail
  if (Array.isArray(detail)) return detail.map((item) => `${item.loc?.slice(1).join('.')}: ${item.msg}`).join('; ')
  return typeof detail === 'string' ? detail : 'Unable to connect. Check the backend and try again.'
}

export function WorkflowProvider({ children }) {
  const { user } = useAuth()
  const [catalog, setCatalog] = useState({ processes: {}, groups: {} })
  const [records, setRecords] = useState([])
  const [people, setPeople] = useState([])
  const [notifications, setNotifications] = useState([])
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return }
    try {
      const [c, r, p, n, w] = await Promise.all([
        api.get('/workflow/catalog'), api.get('/workflow/records'), api.get('/workflow/people'),
        api.get('/workflow/notifications'), api.get('/workflow/rules'),
      ])
      setCatalog(c.data); setRecords(r.data); setPeople(p.data)
      setNotifications(n.data); setRules(w.data); setError('')
    } catch (err) { setError(errorMessage(err)) }
    finally { setLoading(false) }
  }, [user])
  useEffect(() => {
    if (!user) { setRecords([]); setNotifications([]); return }
    setLoading(true)
    refresh()
    const timer = setInterval(refresh, 60000)
    return () => clearInterval(timer)
  }, [user, refresh])
  return <WorkflowContext.Provider value={{ catalog, records, people, rules, notifications, loading, error, refresh }}>{children}</WorkflowContext.Provider>
}

export const useWorkflow = () => useContext(WorkflowContext)

export async function downloadFile(path, filename) {
  const response = await api.get(path, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const recordRoute = (record) => `/records/${record.id}`
export const statusLabel = (value = '') => value.replaceAll('_', ' ').replace(/^./, (s) => s.toUpperCase())
export const statusTone = (value) => ({ completed: 'success', pending_approval: 'warning', finance_queue: 'info', rejected: 'danger', cancelled: 'default', changes_requested: 'warning' })[value] || 'info'
