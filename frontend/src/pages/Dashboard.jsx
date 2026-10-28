import { useState, useEffect } from 'react'
import {
  Activity,
  AlertCircle,
  Clock,
  CreditCard,
  FileText,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Table, {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/Table'

const STATS = [
  { label: 'Active Business Licences', value: '14', delta: '+2 this month', icon: ShieldCheck, color: 'text-teal-600' },
  { label: 'Upcoming Licence Expiries', value: '3', delta: 'within 30 days', icon: AlertCircle, color: 'text-amber-600' },
  { label: 'Insurance Renewals Due', value: '5', delta: 'within 30 days', icon: CreditCard, color: 'text-blue-600' },
  { label: 'Pending Vehicle Requests', value: '2', delta: 'awaiting approval', icon: FileText, color: 'text-navy-700' },
  { label: 'Outstanding Utility Bills', value: '6', delta: 'unpaid', icon: Clock, color: 'text-red-600' },
  { label: 'Pending Memo Approvals', value: '4', delta: 'awaiting sign-off', icon: Users, color: 'text-purple-600' },
]

const MONTHLY_DATA = [
  { name: 'Jan', licences: 2, vehicles: 1 },
  { name: 'Feb', licences: 3, vehicles: 2 },
  { name: 'Mar', licences: 1, vehicles: 3 },
  { name: 'Apr', licences: 4, vehicles: 2 },
  { name: 'May', licences: 3, vehicles: 4 },
  { name: 'Jun', licences: 5, vehicles: 3 },
]

const RECENT_ACTIVITIES = [
  { actor: 'HR Admin', action: 'Submitted vehicle borrowing request', target: 'Van MY-2241', time: '10 min ago', status: 'pending' },
  { actor: 'System Admin', action: 'Approved memo #MEMO-0042', target: 'Office closure notice', time: '2 hours ago', status: 'approved' },
  { actor: 'Finance', action: 'Paid utility bill', target: 'TNB – June', time: '5 hours ago', status: 'approved' },
  { actor: 'HR Admin', action: 'Renewed business licence', target: 'Signboard licence', time: '1 day ago', status: 'approved' },
  { actor: 'Approver', action: 'Returned memo for changes', target: 'Travel policy update', time: '2 days ago', status: 'rejected' },
]

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Dashboard</h1>
          <p className="text-slate-600">Overview of HR Admin operations</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" /> Live
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {STATS.map((stat, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm">{stat.label}</CardTitle>
                <p className="text-xs text-slate-500">{stat.delta}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-teal-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-navy-900">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Activity overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MONTHLY_DATA} margin={{ top: 20, right: 30, left: 20, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                  <YAxis axisLine={false} tickLine={false} hide tick={{ fontSize: 12, fill: '#64748B' }} />
                  <Tooltip />
                  <Bar dataKey="licences" fill="#12263A" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="vehicles" fill="#0E7C7B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent activities */}
        <Card>
          <CardHeader>
            <CardTitle>Recent activities</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RECENT_ACTIVITIES.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-navy-800">{a.actor}</TableCell>
                    <TableCell className="text-slate-600">{a.action}</TableCell>
                    <TableCell className="text-sm text-slate-500">{a.target}</TableCell>
                    <TableCell className="text-sm text-slate-500 text-right">{a.time}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={a.status === 'approved' ? 'approved' : a.status === 'rejected' ? 'rejected' : 'pending'}>
                        {a.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
