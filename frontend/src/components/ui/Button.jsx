import { forwardRef } from 'react'

const Button = forwardRef(({ className = '', type = 'button', variant = 'primary', size = 'md', disabled = false, children, ...props }, ref) => {
  const base =
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-offset-2'
  const variants = {
    primary: 'bg-navy-900 text-white focus:ring-navy-500 hover:bg-navy-800',
    secondary: 'bg-slate-100 text-slate-900 focus:ring-slate-400 hover:bg-slate-200',
    teal: 'bg-teal-600 text-white focus:ring-teal-400 hover:bg-teal-700',
    outline: 'bg-white border border-slate-200 text-slate-700 focus:ring-slate-400 hover:bg-slate-50',
    danger: 'bg-red-50 text-red-700 border border-red-100 focus:ring-red-400 hover:bg-red-100',
    ghost: 'bg-transparent text-slate-600 focus:ring-slate-400 hover:bg-slate-100',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
})

Button.displayName = 'Button'

export default Button
