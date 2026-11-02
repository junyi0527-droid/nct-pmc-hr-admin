export function generateICS({ records }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NCT PMC HR Admin//Utility Bill Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Utility Bill Reminders',
    'X-WR-TIMEZONE:Asia/Kuala_Lumpur',
  ]

  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  for (const record of records) {
    const uid = `ub-${record.id}@nct-pmc`
    const summary = `Utility Bill · ${record.title}`
    const description = [
      `Company: ${record.company || '—'}`,
      `Utility: ${record.data?.utility_type || '—'}`,
      `Bill route: ${record.data?.payment_route || '—'}`,
      `Amount (RM): ${record.data?.amount ? Number(record.data.amount).toFixed(2) : '—'}`,
      `Status: ${record.status.replaceAll('_', ' ')}`,
      `Reference: ${record.number}`,
    ].join('\\n')

    // Reminder event on the calculated reminder date
    if (record.reminder_date) {
      const start = `${record.reminder_date}T090000`
      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}-reminder`,
        `DTSTAMP:${now}`,
        `DTSTART;TZID=Asia/Kuala_Lumpur:${start}`,
        `DTEND;TZID=Asia/Kuala_Lumpur:${start}`,
        `SUMMARY:Reminder · ${summary}`,
        `DESCRIPTION:${description}`,
        `URL:${window.location.origin}/records/${record.id}`,
        'END:VEVENT'
      )
    }

    // Due date event
    if (record.due_date) {
      const start = `${record.due_date}T100000`
      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}-due`,
        `DTSTAMP:${now}`,
        `DTSTART;TZID=Asia/Kuala_Lumpur:${start}`,
        `DTEND;TZID=Asia/Kuala_Lumpur:${start}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `URL:${window.location.origin}/records/${record.id}`,
        'END:VEVENT'
      )
    }
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadICS(content, filename = 'utility-bill-reminders.ics') {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
