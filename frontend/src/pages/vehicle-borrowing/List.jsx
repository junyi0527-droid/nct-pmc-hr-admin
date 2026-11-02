import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Save, Trash2, Truck, Edit2, X, XCircle } from 'lucide-react'
import api from '../../lib/api'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import { useAuth } from '../../contexts/AuthContext'
import Table, {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/Table'
import Card from '../../components/ui/Card'
import { CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import CalendarView from '../../components/ui/CalendarView'
import RecordPanel from '../../components/ui/RecordPanel'
import Skeleton from '../../components/ui/Skeleton'
import { bookingPanel } from '../../lib/bookings'
import VehicleActions from '../../components/workflow/VehicleActions'

const STATUS_LABEL = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
const STATUS_VARIANT = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  completed: 'success',
  cancelled: 'inactive',
}

const EMPTY_VEHICLE = {
  plate_number: '',
  make: '',
  model: '',
  vehicle_type: 'car',
  category: 'pool',
  assigned_to: '',
  status: 'available',
}

export default function VehicleBorrowingList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [showVehicleForm, setShowVehicleForm] = useState(false)
  const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE)
  const [vehicleSaving, setVehicleSaving] = useState(false)
  const [vehicleError, setVehicleError] = useState('')
  const [view, setView] = useState('calendar')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [loadError, setLoadError] = useState('')

  const canManageVehicles = ['system_administrator', 'hr_admin'].includes(user?.role)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      const [rResp, vResp] = await Promise.all([
        api.get('/borrowing?my=false'),
        api.get('/vehicles'),
      ])
      setRequests(rResp.data)
      setVehicles(vResp.data)
    } catch {
      setLoadError('We could not load the vehicle register. Check the backend and try again.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = requests.filter((r) => !statusFilter || r.status === statusFilter)
  const selectedBooking = requests.find((item) => item.id === selectedRequest || String(item.id) === searchParams.get('record'))

  async function createVehicle(e) {
    e.preventDefault()
    setVehicleError('')
    setVehicleSaving(true)
    try {
      await api.post('/vehicles', vehicleForm)
      setVehicleForm(EMPTY_VEHICLE)
      setShowVehicleForm(false)
      await load()
    } catch (err) {
      setVehicleError(err.response?.data?.detail || 'Unable to add vehicle')
    } finally {
      setVehicleSaving(false)
    }
  }

  async function deleteVehicle(vehicle) {
    if (
      !window.confirm(
        `Delete ${vehicle.plate_number}? Vehicles with borrowing history must be deactivated instead.`
      )
    )
      return
    try {
      await api.delete(`/vehicles/${vehicle.id}`)
      await load()
    } catch (err) {
      setVehicleError(err.response?.data?.detail || 'Unable to delete vehicle')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Vehicle Borrowing</h1>
          <p className="text-slate-600">Manage company vehicle borrowing requests</p>
        </div>
        <Button onClick={() => navigate('/vehicle-borrowing/request')} variant="primary">
          <Plus className="w-4 h-4 mr-2" /> New Request
        </Button>
      </div>

      {loadError && (
        <div
          role="alert"
          className="tone-danger flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 text-sm"
        >
          <p>{loadError}</p>
          <Button variant="outline" onClick={load}>
            Try again
          </Button>
        </div>
      )}
      {vehicleError && !showVehicleForm && (
        <p role="alert" className="tone-danger rounded-xl p-4 text-sm">
          {typeof vehicleError === 'string' ? vehicleError : 'Please check your vehicle details.'}
        </p>
      )}

      {canManageVehicles && (
        <section aria-labelledby="vehicle-management-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="vehicle-management-heading" className="text-lg font-semibold text-navy-900">
                Vehicle register
              </h2>
              <p className="text-sm text-slate-600">
                Add vehicles available for borrowing. Delete is restricted when borrowing history
                exists.
              </p>
            </div>
            <Button
              onClick={() => {
                setVehicleError('')
                setShowVehicleForm(!showVehicleForm)
              }}
              variant={showVehicleForm ? 'outline' : 'primary'}
            >
              {showVehicleForm ? (
                <>
                  <X className="mr-2 h-4 w-4" /> Cancel
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" /> Add vehicle
                </>
              )}
            </Button>
          </div>
          {showVehicleForm && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Add vehicle</CardTitle>
              </CardHeader>
              <CardContent>
                {vehicleError && (
                  <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                    {vehicleError}
                  </div>
                )}
                <form onSubmit={createVehicle} className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Input
                    id="plate_number"
                    label="Plate number"
                    value={vehicleForm.plate_number}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, plate_number: e.target.value.toUpperCase() })
                    }
                    required
                  />
                  <Input
                    id="make"
                    label="Make"
                    value={vehicleForm.make}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                    required
                  />
                  <Input
                    id="model"
                    label="Model"
                    value={vehicleForm.model}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                    required
                  />
                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                    Vehicle type
                    <select
                      value={vehicleForm.vehicle_type}
                      onChange={(e) =>
                        setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value })
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="car">Car</option>
                      <option value="van">Van</option>
                      <option value="lorry">Lorry</option>
                      <option value="motorcycle">Motorcycle</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                    Category
                    <select
                      value={vehicleForm.category}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, category: e.target.value })}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="pool">Pool</option>
                      <option value="assigned">Assigned</option>
                      <option value="pool-van">Pool van</option>
                    </select>
                  </label>
                  <Input
                    id="assigned_to"
                    label="Assigned to (optional)"
                    value={vehicleForm.assigned_to}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, assigned_to: e.target.value })
                    }
                  />
                  <div className="flex items-end md:col-span-3">
                    <Button type="submit" variant="primary" disabled={vehicleSaving}>
                      <Save className="mr-2 h-4 w-4" />
                      {vehicleSaving ? 'Saving…' : 'Save vehicle'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Vehicle availability overview */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {vehicles.map((v) => (
          <Card key={v.id} className="flex items-center gap-3 p-4">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                v.status === 'available'
                  ? 'bg-green-100 text-green-700'
                  : v.status === 'on-loan'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
              }`}
            >
              <Truck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-navy-900">{v.plate_number}</div>
              <div className="text-xs text-slate-500">
                {v.make} {v.model}
              </div>
              <Badge
                variant={
                  v.status === 'available'
                    ? 'active'
                    : v.status === 'on-loan'
                      ? 'warning'
                      : 'inactive'
                }
              >
                {v.status}
              </Badge>
            </div>
            {canManageVehicles && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => deleteVehicle(v)}
                title={`Delete ${v.plate_number}`}
                aria-label={`Delete ${v.plate_number}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Booking schedule</h2>
        <div className="flex gap-2" role="group" aria-label="Booking display mode">
          <Button
            size="sm"
            variant={view === 'calendar' ? 'primary' : 'outline'}
            onClick={() => setView('calendar')}
            aria-pressed={view === 'calendar'}
          >
            Calendar
          </Button>
          <Button
            size="sm"
            variant={view === 'table' ? 'primary' : 'outline'}
            onClick={() => setView('table')}
            aria-pressed={view === 'table'}
          >
            Table
          </Button>
        </div>
      </div>
      {view === 'calendar' &&
        (loading ? (
          <Skeleton className="h-80 w-full" />
        ) : (
          <CalendarView
            title="Vehicle booking calendar"
            events={filtered
              .filter((row) => !['rejected', 'cancelled'].includes(row.status))
              .map((row) => ({
                id: row.id,
                title: `${row.vehicle?.plate_number || 'Vehicle'} · ${row.borrow_time || ''}`,
                date: row.borrow_date,
                endDate: row.return_date,
                subtitle: `${row.borrow_time || ''}–${row.return_time || ''} · ${row.status}`,
                tone: row.status === 'approved' ? 'success' : 'warning',
              }))}
            onOpen={(event) => setSelectedRequest(event.id)}
          />
        ))}
      {/* Requests table */}
      {view === 'table' && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between pb-2">
            <CardTitle>Borrowing requests</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Filter by status…"
                aria-label="Filter booking status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-48 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-center text-slate-500">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-slate-500">No borrowing requests found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Requested by</TableHead>
                    <TableHead className="text-center">Borrow → Return</TableHead>
                    <TableHead className="text-center">Purpose</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const v = r.vehicle || {}
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-navy-800">
                          <button
                            className="ui-link rounded"
                            onClick={() => setSelectedRequest(r.id)}
                          >
                            {r.request_number}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{v.plate_number || '—'}</div>
                          <div className="text-xs text-slate-500">
                            {v.make || ''} {v.model || ''}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{r.requester_name || '—'}</TableCell>
                        <TableCell className="text-sm text-center">
                          <div>{r.borrow_date}</div>
                          <div className="text-xs text-slate-500">
                            {r.borrow_time || '09:00'} → {r.return_date} {r.return_time || '17:00'}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-40 text-sm text-slate-600">
                          {r.purpose}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={STATUS_VARIANT[r.status] || 'default'} size="sm">
                            {STATUS_LABEL[r.status] || r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => setSelectedRequest(r.id)}>Details / actions</Button>
                            {r.status === 'pending' && r.requested_by === user?.id && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/vehicle-borrowing/request/${r.id}`)}
                                title="Edit"
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                            )}
                            {(r.status === 'pending' || r.status === 'approved') && !r.collection_recorded_at && (canManageVehicles || r.requested_by === user?.id) && (
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => {
                                  if (window.confirm('Cancel this borrowing request?')) {
                                    api
                                      .post(`/borrowing/${r.id}/action`, { action: 'cancel' })
                                      .then(() => load())
                                      .catch((err) => setLoadError(err.response?.data?.detail || 'Unable to cancel booking'))
                                  }
                                }}
                                title="Cancel"
                              >
                                <XCircle className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
      <RecordPanel
        record={selectedBooking ? bookingPanel(selectedBooking) : null}
        onClose={() => {
          setSelectedRequest(null)
          const next = new URLSearchParams(searchParams)
          next.delete('record')
          setSearchParams(next, { replace: true })
        }}
      >
        {selectedBooking && <VehicleActions key={selectedBooking.id} record={selectedBooking} onSaved={load} />}
      </RecordPanel>
    </div>
  )
}
