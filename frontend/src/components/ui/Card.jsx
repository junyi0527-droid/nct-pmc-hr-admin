export default function Card({ className = '', children, tilt3d = false, ...props }) {
  return (
    <div
      className={`ui-card ${tilt3d ? 'card-3d transform-3d' : ''} ${className}`}
      {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ className = '', children, ...props }) {
  return (
    <div className={`flex flex-col gap-1.5 p-5 sm:p-6 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className = '', children, ...props }) {
  return (
    <h2 className={`text-base font-semibold tracking-tight text-ink ${className}`} {...props}>
      {children}
    </h2>
  )
}

export function CardContent({ className = '', children, ...props }) {
  return (
    <div className={`p-5 pt-0 sm:p-6 sm:pt-0 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className = '', children }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 border-t border-line p-5 ${className}`}>
      {children}
    </div>
  )
}
