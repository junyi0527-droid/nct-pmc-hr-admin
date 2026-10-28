import { useParams } from 'react-router-dom'
import { FolderKanban, AlertTriangle } from 'lucide-react'
import Card from '../components/ui/Card'

export default function PlaceholderPage({ module }) {
  const params = useParams()
  return (
    <Card className="max-w-2xl mx-auto">
      <div className="p-6">
        <div className="flex items-center gap-2 text-teal-600 mb-4">
          <FolderKanban className="w-5 h-5" />
          <span className="font-medium text-navy-900">{module}</span>
        </div>
        <h2 className="text-lg font-semibold text-navy-800 mb-2">Module under construction</h2>
        <p className="text-slate-600 mb-4">
          The <strong>{module}</strong> module is being implemented next. Navigation is wired up;
          the API endpoints will be connected as each module is built.
        </p>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          <AlertTriangle className="w-4 h-4 mr-2" /> Business rules marked <em>[to confirm]</em> will
          be filled in once NCT PMC confirms the applicable SOPs.
        </div>
      </div>
    </Card>
  )
}
