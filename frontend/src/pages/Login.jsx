import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeftRight, ArrowRight, Check, Eye, EyeOff, LifeBuoy, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'

const DEMO_ACCOUNTS = [
  { email: 'hr@nctpmc.com.my', password: 'NctDemo#2026', role: 'HR Manager' },
  { email: 'admin@nctpmc.com.my', password: 'NctDemo#2026', role: 'System Admin' },
  { email: 'pm@nctpmc.com.my', password: 'PmDemo#2026', role: 'Project Manager' },
]

function MosaicLogo({ tile = 14, gap = 3, small = false }) {
  const pattern = ['gold', 'ivory', 'gold-dark', 'gold', 'ivory', 'gold-dark', 'gold', 'ivory', 'gold-dark', 'gold', 'ivory', 'gold-dark', 'gold-dark', 'ivory', 'gold', 'gold']
  return <div className={`nct-mosaic ${small ? 'nct-mosaic-small' : ''}`} style={{ '--nct-tile': `${tile}px`, '--nct-gap': `${gap}px` }} role="img" aria-label="NCT Alliance logo">{pattern.map((tone, index) => <span key={index} className={`nct-tile nct-tile-${tone}`} />)}</div>
}

function GoldDust() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return undefined
    let frame = 0
    let width = 0
    let height = 0
    let particles = []
    const tones = ['#E9CE8C', '#D4AF5E', '#C9A24B', '#F5E7C4', '#B98A2F']
    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = bounds.width
      height = bounds.height
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      particles = Array.from({ length: Math.min(88, Math.max(34, Math.round((width * height) / 15000))) }, () => ({ x: Math.random() * width, y: Math.random() * height, radius: .6 + Math.random() * 1.9, alpha: .2 + Math.random() * .6, phase: Math.random() * Math.PI * 2, speed: .4 + Math.random() * 1.2, rise: .08 + Math.random() * .28, wobble: 6 + Math.random() * 18, wobbleSpeed: .2 + Math.random() * .6, color: tones[Math.floor(Math.random() * tones.length)] }))
    }
    let time = 0
    const draw = () => {
      time += .016
      context.clearRect(0, 0, width, height)
      particles.forEach((particle) => { particle.y -= particle.rise; if (particle.y < -8) { particle.y = height + 8; particle.x = Math.random() * width }; const x = particle.x + Math.sin(time * particle.wobbleSpeed + particle.phase) * particle.wobble * .15; const alpha = particle.alpha * (.45 + .55 * Math.sin(time * particle.speed + particle.phase) ** 2); context.beginPath(); context.arc(x, particle.y, particle.radius, 0, Math.PI * 2); context.fillStyle = particle.color; context.globalAlpha = Math.max(alpha, .03); context.shadowColor = particle.color; context.shadowBlur = particle.radius > 1.5 ? 8 : 0; context.fill() })
      context.globalAlpha = 1
      context.shadowBlur = 0
      frame = window.requestAnimationFrame(draw)
    }
    resize(); draw(); window.addEventListener('resize', resize)
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} className="nct-dust" aria-hidden="true" />
}

function FloatingField({ id, label, icon: Icon, type, value, onChange, trailing, autoComplete, flash }) {
  const [focused, setFocused] = useState(false)
  const active = focused || value.length > 0
  return <div className={`nct-rich-field ${focused ? 'is-focused' : ''} ${flash ? 'is-flash' : ''}`}><Icon className="nct-field-icon" size={18} /><input id={id} type={type} value={value} autoComplete={autoComplete} placeholder=" " onChange={(event) => onChange(event.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} /><label htmlFor={id} className={active ? 'is-active' : ''}>{label}</label>{trailing && <div className="nct-field-action">{trailing}</div>}</div>
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('idle')
  const [flash, setFlash] = useState(false)
  const [ripples, setRipples] = useState([])
  const cardRef = useRef(null)

  const handleStageMouseMove = (event) => {
    if (!cardRef.current) return
    const bounds = cardRef.current.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width - .5
    const y = (event.clientY - bounds.top) / bounds.height - .5
    cardRef.current.style.setProperty('--nct-rotate-x', `${y * -4.2}deg`)
    cardRef.current.style.setProperty('--nct-rotate-y', `${x * 4.6}deg`)
    cardRef.current.style.setProperty('--nct-sheen-x', `${event.clientX - bounds.left - 210}px`)
    cardRef.current.style.setProperty('--nct-sheen-y', `${event.clientY - bounds.top - 210}px`)
  }

  const resetStageTilt = () => { if (cardRef.current) { cardRef.current.style.setProperty('--nct-rotate-x', '0deg'); cardRef.current.style.setProperty('--nct-rotate-y', '0deg') } }

  const spawnRipple = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    setRipples((current) => [...current, { id: Date.now(), x: event.clientX - bounds.left, y: event.clientY - bounds.top }])
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (!email.trim() || !password) return setError('Please enter both your email address and password.')
    setStatus('loading')
    try {
      const res = await api.post('/auth/login', { email, password })
      const { token, user } = res.data
      login(token.access_token, user)
      setStatus('success')
      const destination = location.state?.from ? `${location.state.from.pathname}${location.state.from.search || ''}${location.state.from.hash || ''}` : '/dashboard'
      window.setTimeout(() => navigate(destination, { replace: true }), 550)
    } catch (err) {
      setStatus('idle')
      setError(err.response?.data?.detail || 'Incorrect email or password. Please try again.')
    }
  }

  const autofill = (account) => {
    setEmail(account.email)
    setPassword(account.password)
    setError('')
    setFlash(true)
    window.setTimeout(() => setFlash(false), 800)
  }

  const rippleElements = ripples.map((ripple) => <span key={ripple.id} className="nct-ripple" style={{ left: `${ripple.x - 60}px`, top: `${ripple.y - 60}px` }} onAnimationEnd={() => setRipples((current) => current.filter((item) => item.id !== ripple.id))} />)

  return <main className="nct-login-page nct-rich-login" onMouseMove={handleStageMouseMove} onMouseLeave={resetStageTilt}>
    <div className="nct-architecture" aria-hidden="true" /><div className="nct-vignette" aria-hidden="true" /><div className="nct-grid" aria-hidden="true" /><div className="nct-aurora nct-aurora-a" aria-hidden="true" /><div className="nct-aurora nct-aurora-b" aria-hidden="true" /><GoldDust /><div className="nct-frame" aria-hidden="true"><span /><span /><span /><span /></div>
    <header className="nct-rich-header"><div className="nct-rich-brand"><MosaicLogo tile={9} gap={2} small /><span>NCT ALLIANCE</span></div><button type="button" className="nct-help"><LifeBuoy size={14} /> Need help?</button></header>
    <div className="nct-rich-card-wrap"><span className="nct-rich-corner corner-tl" /><span className="nct-rich-corner corner-tr" /><span className="nct-rich-corner corner-bl" /><span className="nct-rich-corner corner-br" />
      <section className="nct-rich-card" id="nct-card" ref={cardRef}><div className="nct-card-sheen" /><div className="nct-card-hairline" />
        <div className="nct-rich-content">
          <div className="nct-rich-logo nct-stagger-1"><span className="nct-logo-halo" /><MosaicLogo tile={17} gap={4} /><p>NCT ALLIANCE</p><small>Building excellence</small></div>
          <div className="nct-rich-heading nct-stagger-2"><span>{new Date().getHours() < 12 ? 'GOOD MORNING' : new Date().getHours() < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING'}</span><h1>Welcome <em>back</em></h1><p>Sign in to your NCT workspace.</p></div>
          <form onSubmit={handleSubmit} className="nct-rich-form nct-stagger-3" noValidate>
            {error && <div className="nct-rich-error" role="alert"><AlertCircle size={16} /><span>{error}</span></div>}
            {showForgotPassword ? <><p className="nct-forgot-copy">Enter your work email to request a password reset. This prototype does not send email yet.</p><FloatingField id="forgot-email" label="Work email" icon={Mail} type="email" value={email} onChange={setEmail} autoComplete="email" /><button type="button" className="nct-rich-submit nct-stagger-4" onClick={() => setError('Password reset is not connected in the prototype. Please contact the system administrator.')}>Request reset link <ArrowRight size={16} /></button><button type="button" className="nct-back" onClick={() => { setShowForgotPassword(false); setError('') }}>Back to sign in</button></> : <><FloatingField id="email" label="Email address" icon={Mail} type="email" value={email} onChange={setEmail} autoComplete="email" flash={flash} /><FloatingField id="password" label="Password" icon={Lock} type={showPassword ? 'text' : 'password'} value={password} onChange={setPassword} autoComplete="current-password" flash={flash} trailing={<button type="button" className="nct-eye" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>} /><div className="nct-rich-options"><label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>Remember me</span></label><button type="button" onClick={() => { setShowForgotPassword(true); setError('') }}>Forgot password?</button></div><button type="submit" className="nct-rich-submit nct-stagger-4" disabled={status === 'loading' || status === 'success'} onClick={spawnRipple}>{rippleElements}<span className="nct-submit-label">{status === 'success' ? <><Check size={18} /> Signed in</> : status === 'loading' ? <><Loader2 size={18} className="nct-spin" /> Signing you in…</> : <><Lock size={15} /> Sign in <ArrowRight size={16} /></>}</span></button></>}
          </form>
          {import.meta.env.DEV && !showForgotPassword && <div className="nct-rich-demo nct-stagger-5"><div className="nct-demo-title"><ShieldCheck size={15} /> Demo accounts — development only</div>{DEMO_ACCOUNTS.map((account) => <button type="button" className="nct-rich-demo-row" key={account.email} onClick={() => autofill(account)}><span><strong>{account.email}</strong><small>{account.password} · {account.role}</small></span><ArrowLeftRight size={16} /></button>)}</div>}
        </div>
      </section>
    </div>
    <footer className="nct-rich-footer"><span>© 2026 NCT Alliance Berhad</span><span><a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="#support">Support</a></span></footer>
  </main>
}
