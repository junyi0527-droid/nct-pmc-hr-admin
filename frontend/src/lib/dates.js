export function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
export function addDays(key, days) {
  const date = new Date(`${key}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
export function daysUntil(key) {
  return Math.round(
    (Date.parse(`${key}T12:00:00Z`) - Date.parse(`${todayKey()}T12:00:00Z`)) / 86400000
  )
}
export function formatDate(key, options = {}) {
  if (!key) return 'Not recorded'
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kuala_Lumpur',
    ...options,
  }).format(new Date(key.length === 10 ? `${key}T12:00:00Z` : key))
}
export function dueLabel(key) {
  const days = daysUntil(key)
  return days < 0
    ? `${Math.abs(days)} days overdue`
    : days === 0
      ? 'Due today'
      : `${days} days left`
}
export function urgency(key) {
  return daysUntil(key) < 0 ? 'danger' : daysUntil(key) <= 30 ? 'warning' : 'info'
}
