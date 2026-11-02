import Card, { CardHeader, CardTitle } from '../components/ui/Card'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { formatDate } from '../lib/dates'

export default function ActivityReport() {
  const { records } = useWorkspace()
  const rows = records
    .flatMap((row) =>
      row.history.map((event, i) => ({
        id: `${row.id}-${i}`,
        actor: event.actor,
        action: event.title,
        title: row.title,
        date: event.at,
      }))
    )
    .sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="space-y-6">
      <div>
        <Badge variant="info">Demo report</Badge>
        <h1 className="mt-3 text-3xl font-bold">Reports & activity</h1>
        <p className="mt-2 text-sm text-muted">
          Search and sort the activity recorded in this demo session.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All activities</CardTitle>
        </CardHeader>
        <DataTable
          caption="All activities"
          rows={rows}
          columns={[
            { key: 'actor', label: 'Actor' },
            { key: 'action', label: 'Action' },
            { key: 'title', label: 'Item' },
            { key: 'date', label: 'Date (MYT)', render: (row) => formatDate(row.date) },
          ]}
        />
      </Card>
    </div>
  )
}
