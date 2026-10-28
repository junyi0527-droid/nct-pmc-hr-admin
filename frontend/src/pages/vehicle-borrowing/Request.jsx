import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Truck, Calendar, FileText } from 'lucide-react'
import api from '../../lib/api'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import { CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'

export default function VehicleBorrowingRequest() {
  const navigate = useNavigate()
  const { id } = useParams()
  const editMode = !!id
  const [vehicles, setVehicles] = useState([])
  const [form, setForm] = useState({
    vehicle_id: '', purpose: '', borrow_date: '', return_date: '',
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/vehicles').then((r) => setVehicles(r.data))
    if (editMode) {
      api.get(`/borrowing/${id}`).then((r) => {
        const d = r.data
        setForm({
          vehicle_id: String(d.vehicle_id),
          purpose: d.purpose,
          borrow_date: d.borrow_date,
          return_date: d.return_date,
        })
      })
    }
  }, [editMode, id])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (editMode) {
        await api.put(`/borrowing/${id}`, form)
      } else {
        await api.post('/borrowing', form)
      }
      navigate('/vehicle-borrowing')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save request')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>{editMode ? 'Edit Borrowing Request' : 'New Borrowing Request'}</CardTitle>
        <Button onClick={() => navigate('/vehicle-borrowing')} variant="outline" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" /> {error}
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Vehicle *</label>
              <select
                value={form.vehicle_id}
                onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
              >
                <option value="">Select a vehicle</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id} disabled={v.status !== 'available'}>
                    {v.plate_number} — {v.make} {v.model} ({v.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Purpose *</label>
              <Input
                id="purpose"
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                placeholder="e.g. Client site visit in KL"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Borrow date *</label>
              <Input
                id="borrow_date"
                type="date"
                value={form.borrow_date}
                onChange={(e) => setForm({ ...form, borrow_date: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Return date *</label>
              <Input
                id="return_date"
                type="date"
                value={form.return_date}
                onChange={(e) => setForm({ ...form, return_date: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Truck className="w-4 h-4" />
              <span>Overlapping confirmed bookings are prevented automatically.</span>
            </div>
            <Button type="submit" variant="primary" disabled={saving} className="w-auto">
              <Save className="w-4 h-4 mr-2" /> {saving ? 'Saving…' : editMode ? 'Update' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
