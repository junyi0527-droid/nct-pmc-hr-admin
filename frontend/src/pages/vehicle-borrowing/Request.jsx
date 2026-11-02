import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Calendar, Clock3, FileText, Save, Truck } from 'lucide-react'
import api from '../../lib/api'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import { CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import { bookingConflicts } from '../../lib/bookings'
import { useToast } from '../../contexts/ToastContext'

export default function VehicleBorrowingRequest() {
  const navigate = useNavigate()
  const { id } = useParams()
  const editMode = !!id
  const [vehicles, setVehicles] = useState([])
  const [bookings, setBookings] = useState([])
  const notify = useToast()
  const [form, setForm] = useState({
    vehicle_id: '',
    purpose: '',
    borrow_date: '',
    borrow_time: '09:00',
    return_date: '',
    return_time: '17:00',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      api.get('/vehicles'),
      api.get('/borrowing?my=false'),
      editMode ? api.get(`/borrowing/${id}`) : Promise.resolve(null),
    ])
      .then(([vehiclesResponse, bookingsResponse, requestResponse]) => {
        if (!active) return
        setVehicles(vehiclesResponse.data)
        setBookings(bookingsResponse.data)
        if (requestResponse) {
          const d = requestResponse.data
          setForm({
            vehicle_id: String(d.vehicle_id),
            purpose: d.purpose,
            borrow_date: d.borrow_date,
            borrow_time: d.borrow_time || '09:00',
            return_date: d.return_date,
            return_time: d.return_time || '17:00',
          })
        }
      })
      .catch(() => {
        if (active)
          setError('Unable to load vehicles and bookings. Please check the backend and reload.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [editMode, id])
  const conflicts = bookingConflicts(bookings, { ...form, id })
  const periodInvalid =
    form.borrow_date &&
    form.return_date &&
    `${form.return_date}T${form.return_time}` <= `${form.borrow_date}T${form.borrow_time}`

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (periodInvalid || conflicts.length) {
      setError(
        periodInvalid
          ? 'Choose a return date and time after collection.'
          : 'Choose another time; this vehicle has a confirmed booking.'
      )
      return
    }
    setSaving(true)
    try {
      if (editMode) {
        const { vehicle_id, ...changes } = form
        await api.put(`/borrowing/${id}`, changes)
      } else {
        await api.post('/borrowing', form)
      }
      notify(editMode ? 'Booking updated' : 'Vehicle booking submitted')
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
        <h1 className="text-xl font-semibold">
          {editMode ? 'Edit Borrowing Request' : 'New Borrowing Request'}
        </h1>
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
        {conflicts.length > 0 && (
          <div role="alert" className="tone-warning mb-4 rounded-xl p-4 text-sm">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            Booking conflict:{' '}
            {conflicts
              .map(
                (row) =>
                  `${row.request_number} (${row.borrow_date} ${row.borrow_time}–${row.return_date} ${row.return_time})`
              )
              .join(', ')}
            . Please choose another time.
          </div>
        )}
        {periodInvalid && (
          <p role="alert" className="tone-danger mb-4 rounded-xl p-3 text-sm">
            Return must be after the borrow date and time.
          </p>
        )}
        <form onSubmit={onSubmit} className="space-y-5" aria-busy={loading}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="vehicle_id" className="text-sm font-medium text-slate-700">
                Vehicle *
              </label>
              <select
                id="vehicle_id"
                required
                disabled={editMode || loading}
                value={form.vehicle_id}
                onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
              >
                <option value="">Select a vehicle</option>
                {vehicles.map((v) => (
                  <option
                    key={v.id}
                    value={v.id}
                    disabled={['maintenance', 'off-road'].includes(v.status) && String(v.id) !== form.vehicle_id}
                  >
                    {v.plate_number} — {v.make} {v.model} ({v.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="purpose" className="text-sm font-medium text-slate-700">
                Purpose *
              </label>
              <Input
                id="purpose"
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                placeholder="e.g. Client site visit in KL"
                required
                maxLength={1000}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="borrow_date"
                className="flex items-center gap-2 text-sm font-medium text-slate-700"
              >
                <Calendar className="h-4 w-4 text-teal-700" /> Borrow date *
              </label>
              <Input
                id="borrow_date"
                type="date"
                value={form.borrow_date}
                onChange={(e) => setForm({ ...form, borrow_date: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="return_date"
                className="flex items-center gap-2 text-sm font-medium text-slate-700"
              >
                <Calendar className="h-4 w-4 text-teal-700" /> Return date *
              </label>
              <Input
                id="return_date"
                type="date"
                value={form.return_date}
                onChange={(e) => setForm({ ...form, return_date: e.target.value })}
                min={form.borrow_date || undefined}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="borrow_time"
                className="flex items-center gap-2 text-sm font-medium text-slate-700"
              >
                <Clock3 className="h-4 w-4 text-teal-700" /> Borrow time *
              </label>
              <Input
                id="borrow_time"
                type="time"
                value={form.borrow_time}
                onChange={(e) => setForm({ ...form, borrow_time: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="return_time"
                className="flex items-center gap-2 text-sm font-medium text-slate-700"
              >
                <Clock3 className="h-4 w-4 text-teal-700" /> Return time *
              </label>
              <Input
                id="return_time"
                type="time"
                value={form.return_time}
                onChange={(e) => setForm({ ...form, return_time: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Truck className="w-4 h-4" />
              <span>
                Use the calendar buttons to select dates. Confirmed bookings cannot overlap for the
                same vehicle and time.
              </span>
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={saving || loading || !!periodInvalid || conflicts.length > 0}
              className="w-auto"
            >
              <Save className="w-4 h-4 mr-2" />{' '}
              {saving ? 'Saving…' : editMode ? 'Update' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
