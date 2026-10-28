import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Truck, Edit2, XCircle } from 'lucide-react'
import api from '../../lib/api'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Table, {
  TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/Table'
import Card from '../../components/ui/Card'
import { CardHeader, CardTitle, CardContent } from '../../components/ui/Card'

const STATUS_LABEL = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
  completed: 'Completed', cancelled: 'Cancelled',
}
const STATUS_VARIANT = {
  pending: 'pending', approved: 'approved', rejected: 'rejected',
  completed: 'success', cancelled: 'inactive',
}

export default function VehicleBorrowingList() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [rResp, vResp] = await Promise.all([
        api.get('/borrowing?my=false'), api.get('/vehicles'),
      ])
      setRequests(rResp.data)
      setVehicles(vResp.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const filtered = requests.filter((r) => !statusFilter || r.status === statusFilter)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Vehicle Borrowing</h1>
          <p className="text-slate-600">Manage company vehicle borrowing requests</p>
        </div>
        <Button onClick={() => navigate('/vehicle-borrowing/request')} variant="primary">
          <Plus className="w-4 h-4 mr-2" /> New Request
        </Button>
      </div>

      {/* Vehicle availability overview */}
      <Card className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {vehicles.map((v) => (
          <Card key={v.id} className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              v.status === 'available' ? 'bg-green-100 text-green-700' :
              v.status === 'on-loan' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
            }`}>
              <Truck className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-navy-900">{v.plate_number}</div>
              <div className="text-xs text-slate-500">{v.make} {v.model}</div>
              <Badge variant={v.status === 'available' ? 'active' : v.status === 'on-loan' ? 'warning' : 'inactive'}>
                {v.status}
              </Badge>
            </div>
          </Card>
        ))}
      </Card>
      {/* Requests table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Borrowing requests</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Filter by status…"
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
                      <TableCell className="font-medium text-navy-800">{r.request_number}</TableCell>
                      <TableCell>
                        <div className="text-sm">{v.plate_number || '—'}</div>
                        <div className="text-xs text-slate-500">{v.make || ''} {v.model || ''}</div>
                      </TableCell>
                      <TableCell className="text-sm">{r.requester_name || '—'}</TableCell>
                      <TableCell className="text-sm text-center">
                        <div>{r.borrow_date}</div>
                        <div className="text-xs text-slate-500">{r.return_date}</div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 line-clamp-1">{r.purpose}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={STATUS_VARIANT[r.status] || 'default'} size="sm">
                          {STATUS_LABEL[r.status] || r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {r.status === 'pending' && (
                            <Button size="sm" variant="outline"
                              onClick={() => navigate(`/vehicle-borrowing/request/${r.id}`)}
                              title="Edit">
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          )}
                          {(r.status === 'pending' || r.status === 'approved') && (
                            <Button size="sm" variant="danger"
                              onClick={() => {
                                if (window.confirm('Cancel this borrowing request?')) {
                                  api.post(`/borrowing/${r.id}/action`, { action: 'cancel' }).then(() => load())
                                }
                              }}
                              title="Cancel">
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
    </div>
  )
}
