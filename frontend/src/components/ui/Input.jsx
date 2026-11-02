import { forwardRef } from 'react'

const Input = forwardRef(
  ({ className = '', type = 'text', error = false, label, id, ...props }, ref) => (
    <div className="mb-4">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        type={type}
        aria-invalid={error || undefined}
        className={`ui-field ${className}`}
        {...props}
      />
    </div>
  )
)

Input.displayName = 'Input'
export default Input
