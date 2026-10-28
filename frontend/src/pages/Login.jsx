import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, AlertCircle, Building } from 'lucide-react'
import api from '../lib/api'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Card, { CardHeader, CardContent } from '../components/ui/Card'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password })
      const { token, user } = res.data
      localStorage.setItem('nct_hr_token', token.access_token)
      navigate('/dashboard')
    } catch (err) {
      setError(
        err.response?.data?.detail || 'Incorrect email or password. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-navy-900">
      {/* Left brand panel */}
      <div className="hidden md:w-1/2 flex flex-col items-center justify-center bg-navy-800 text-white p-12">
        <Building className="w-14 h-14 text-teal-400 mb-4" />
        <h1 className="text-3xl font-bold tracking-tight">NCT PMC Sdn Bhd</h1>
        <p className="mt-2 text-slate-300 text-center max-w-xs">
          HR Admin Digitalization System — sign in to your account.
        </p>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <h2 className="text-xl font-bold text-navy-900">Welcome back</h2>
            <p className="text-slate-600 text-sm">Sign in to continue</p>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="email"
                label="Email address"
                type="email"
                placeholder="you@nctpmc.com.my"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                id="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
            <div className="mt-6 text-center text-sm text-slate-500">
              Synthetic test accounts (development only):<br />
              hr@nctpmc.com.my / NctDemo#2026<br />
              admin@nctpmc.com.my / NctDemo#2026
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
