import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import Login from './pages/Login'
import { PublicLayout, ProtectedLayout } from './pages/AppShell'
import VehicleBorrowingList from './pages/vehicle-borrowing/List'
import VehicleBorrowingRequest from './pages/vehicle-borrowing/Request'
import { lazy } from 'react'
import Appearance from './pages/Appearance'
import WorkflowPage from './pages/WorkflowPage'
import CalendarPage from './pages/Calendar'
const WorkflowRecord = lazy(() => import('./pages/WorkflowRecord'))
import WorkflowDirectory from './pages/WorkflowDirectory'
import OperationsDashboard from './pages/OperationsDashboard'
const InventoryPage = lazy(() => import('./pages/InventoryPage'))
const CashPage = lazy(() => import('./pages/CashPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [{ path: 'login', element: <Login /> }],
  },
  {
    element: <ProtectedLayout />,
    children: [
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <OperationsDashboard /> },
      { path: 'workflows', element: <WorkflowDirectory /> },
      { path: 'records/:id', element: <WorkflowRecord /> },
      { path: 'business-licence', element: <WorkflowPage key="licences" group="licences" /> },
      { path: 'vehicle-insurance', element: <WorkflowPage key="insurance" group="insurance" /> },
      { path: 'vehicle-borrowing', element: <VehicleBorrowingList /> },
      { path: 'vehicle-borrowing/request', element: <VehicleBorrowingRequest /> },
      { path: 'vehicle-borrowing/request/:id', element: <VehicleBorrowingRequest /> },
      { path: 'utility-bills', element: <WorkflowPage key="utilities" group="utilities" /> },
      {
        path: 'purchase-requisitions',
        element: <WorkflowPage key="purchasing" group="purchasing" />,
      },
      { path: 'petty-cash', element: <CashPage /> },
      { path: 'uniforms', element: <InventoryPage /> },
      {
        path: 'maintenance',
        element: <WorkflowPage key="maintenance" group="maintenance" />,
      },
      { path: 'memo', element: <WorkflowPage key="memos" group="memos" /> },
      { path: 'documents', element: <WorkflowPage key="documents" group="documents" /> },
      { path: 'approvals', element: <WorkflowPage key="approvals" mode="approvals" /> },
      { path: 'finance', element: <WorkflowPage key="finance" mode="finance" /> },
      { path: 'payments', element: <WorkflowPage key="payments" group="finance" /> },
      { path: 'reports', element: <OperationsDashboard report /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'settings', element: <Appearance /> },
      { path: 'calendar', element: <CalendarPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
