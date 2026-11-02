import { createContext, useContext, useState } from 'react'
import { INITIAL_RECORDS } from '../data/workspace'
import { todayKey } from '../lib/dates'
import { useToast } from './ToastContext'

const WorkspaceContext = createContext(null)
export function WorkspaceProvider({ children }) {
  // Demo state deliberately lasts for this session only. Server records are separate.
  const [records, setRecords] = useState(INITIAL_RECORDS)
  const [readNotifications, setReadNotifications] = useState([])
  const notify = useToast()
  function updateRecord(id, changes) {
    const previous = records.find((row) => row.id === id)
    if (!previous) return
    const revision = crypto.randomUUID()
    setRecords((rows) =>
      rows.map((row) =>
        row.id === id
          ? {
              ...row,
              ...changes,
              revision,
              history: [
                ...row.history,
                {
                  title: changes.status ? `Moved to ${changes.status}` : 'Details updated',
                  actor: 'Demo workspace user',
                  at: todayKey(),
                },
              ],
            }
          : row
      )
    )
    notify(`${id} updated in demo workspace`, () =>
      setRecords((rows) =>
        rows.map((row) => (row.id === id && row.revision === revision ? previous : row))
      )
    )
  }
  function archiveRecords(ids) {
    const previous = records.filter((row) => ids.includes(row.id))
    const revision = crypto.randomUUID()
    setRecords((rows) =>
      rows.map((row) => (ids.includes(row.id) ? { ...row, archived: true, revision } : row))
    )
    notify(`${ids.length} demo record${ids.length === 1 ? '' : 's'} archived`, () =>
      setRecords((rows) =>
        rows.map((row) =>
          row.revision === revision ? previous.find((item) => item.id === row.id) || row : row
        )
      )
    )
  }
  function addRecord(record) {
    const created = {
      ...record,
      id: `DEMO-${crypto.randomUUID().slice(0, 8)}`,
      archived: false,
      history: [{ title: 'Demo record created', actor: 'Demo workspace user', at: todayKey() }],
    }
    setRecords((rows) => [...rows, created])
    notify('Demo record created', () =>
      setRecords((rows) => rows.filter((row) => row.id !== created.id))
    )
  }
  return (
    <WorkspaceContext.Provider
      value={{
        records,
        updateRecord,
        archiveRecords,
        addRecord,
        readNotifications,
        setReadNotifications,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}
export const useWorkspace = () => useContext(WorkspaceContext)
