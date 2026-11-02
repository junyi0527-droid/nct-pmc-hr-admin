import { useId, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, formatDate, todayKey } from '../../lib/dates'
import Button from './Button'
import Card from './Card'

export default function CalendarView({ events, onOpen, title = 'Calendar', onSelectDate }) {
  const headingId = useId()
  const [month, setMonth] = useState(() => `${todayKey().slice(0, 7)}-01`)
  const [selected, setSelected] = useState('')
  const monthDate = new Date(`${month}T12:00:00Z`)
  const offset = (monthDate.getUTCDay() + 6) % 7
  const days = Array.from({ length: 42 }, (_, i) => addDays(month, i - offset))
  const eventsOn = (date) =>
    events.filter((event) => event.date <= date && (event.endDate || event.date) >= date)
  const monthEvents = events.filter(
    (event) => event.date <= days[41] && (event.endDate || event.date) >= month
  )
  function changeMonth(delta) {
    const next = new Date(`${month}T12:00:00Z`)
    next.setUTCMonth(next.getUTCMonth() + delta)
    setMonth(next.toISOString().slice(0, 10))
    setSelected('')
  }
  function selectDate(date) {
    setSelected(date)
    onSelectDate?.(date)
  }
  const eventButton = (event) => (
    <button
      key={event.id}
      onClick={() => onOpen(event)}
      title={event.title}
      className={`ui-badge w-full min-w-0 justify-start rounded-md text-left ${event.tone ? `tone-${event.tone}` : 'tone-info'}`}
    >
      <span className="truncate">{event.title}</span>
    </button>
  )
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
        <div>
          <h2 id={headingId} className="flex items-center gap-2 font-semibold">
            <CalendarDays className="h-4 w-4 text-accent" /> {title}
          </h2>
          <p className="mt-1 text-xs text-muted" aria-live="polite">
            {formatDate(month, { day: undefined, month: 'long' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMonth(`${todayKey().slice(0, 7)}-01`)
              setSelected('')
            }}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Previous month"
            onClick={() => changeMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Next month" onClick={() => changeMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="hidden sm:block" role="group" aria-labelledby={headingId}>
        <div className="grid grid-cols-7 border-b border-line bg-subtle text-center text-[11px] font-semibold text-muted">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <span key={day} className="py-3">
              {day}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((date) => (
            <div
              key={date}
              className={`min-h-28 min-w-0 border-b border-r border-line p-1.5 ${date.slice(0, 7) !== month.slice(0, 7) ? 'bg-subtle' : ''}`}
            >
              <button
                onClick={() => selectDate(date)}
                aria-label={`Show events on ${formatDate(date)}`}
                aria-pressed={selected === date}
                aria-current={date === todayKey() ? 'date' : undefined}
                className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs ${date === todayKey() || date === selected ? 'bg-[#0e7c7b] font-bold text-white' : 'text-muted hover:bg-subtle'}`}
              >
                {Number(date.slice(-2))}
              </button>
              <div className="space-y-1">
                {eventsOn(date).slice(0, 2).map(eventButton)}
                {eventsOn(date).length > 2 && (
                  <button className="ui-link p-1 text-xs" onClick={() => selectDate(date)}>
                    +{eventsOn(date).length - 2} more
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={`${selected ? '' : 'sm:hidden'} space-y-2 p-5`}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">
            {selected ? formatDate(selected) : 'This month'}
          </h3>
          {selected && (
            <button className="ui-link text-xs" onClick={() => setSelected('')}>
              Clear date
            </button>
          )}
        </div>
        {(selected ? eventsOn(selected) : monthEvents).map((event) => (
          <div key={event.id} className="flex items-center gap-3 rounded-lg border border-line p-3">
            <div className="min-w-0 flex-1">
              {eventButton(event)}
              <p className="mt-1 text-xs text-muted">
                {formatDate(event.date)}
                {event.subtitle && ` · ${event.subtitle}`}
              </p>
            </div>
          </div>
        ))}
        {(selected ? eventsOn(selected) : monthEvents).length === 0 && (
          <p className="py-4 text-sm text-muted">
            No items scheduled for this {selected ? 'day' : 'month'}.
          </p>
        )}
      </div>
    </Card>
  )
}
