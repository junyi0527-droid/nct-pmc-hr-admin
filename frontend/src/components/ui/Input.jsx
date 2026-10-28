import { forwardRef } from 'react'

const Input = forwardRef(
  ({ className = '', type = 'text', error = false, label, id, ...props }, ref) => (
    <div className="mb-4">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        type={type}
        className={`block w-full rounded-lg border px-3 py-2 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all disabled:bg-slate-50 disabled:border-slate-200 ${
          error ? 'border-red-500 focus:ring-red-500' : 'border-slate-200'
        } ${className}`}
        {...props}
      />
    </div>
  )
)

Input.displayName = 'Input'
export default Input
