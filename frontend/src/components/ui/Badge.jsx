const VARIANTS = {
  default: '',
  success: 'tone-success',
  warning: 'tone-warning',
  danger: 'tone-danger',
  info: 'tone-info',
  pending: 'tone-warning',
  approved: 'tone-success',
  rejected: 'tone-danger',
  active: 'tone-success',
  inactive: '',
  expired: 'tone-danger',
}

export default function Badge({ variant = 'default', className = '', children, ...props }) {
  return (
    <span className={`ui-badge ${VARIANTS[variant] || ''} ${className}`} {...props}>
      {children}
    </span>
  )
}
