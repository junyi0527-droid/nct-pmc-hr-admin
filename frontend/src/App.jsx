import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AppShell from './pages/AppShell'
import VehicleBorrowingList from './pages/vehicle-borrowing/List'
import VehicleBorrowingRequest from './pages/vehicle-borrowing/Request'
import PlaceholderPage from './pages/Placeholder'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { path: 'login', element: <Login /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'business-licence', element: <PlaceholderPage module="Business Licence Renewal" /> },
      { path: 'vehicle-insurance', element: <PlaceholderPage module="Vehicle Insurance Renewal" /> },
      { path: 'vehicle-borrowing', element: <VehicleBorrowingList /> },
      { path: 'vehicle-borrowing/request', element: <VehicleBorrowingRequest /> },
      { path: 'vehicle-borrowing/request/:id', element: <VehicleBorrowingRequest /> },
      { path: 'utility-bills', element: <PlaceholderPage module="Utility Bill Management" /> },
      { path: 'memo', element: <PlaceholderPage module="Memo Preparation & Approval" /> },
      { path: 'approvals', element: <PlaceholderPage module="Approvals" /> },
      { path: 'reports', element: <PlaceholderPage module="Reports" /> },
      { path: 'users', element: <PlaceholderPage module="User Management" /> },
      { path: 'settings', element: <PlaceholderPage module="Settings" /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
