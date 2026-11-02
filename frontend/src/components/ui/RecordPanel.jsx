import { Check, Clock } from 'lucide-react'
import Dialog from './Dialog'
import Badge from './Badge'
import { formatDate, dueLabel, urgency } from '../../lib/dates'
import { MEMO_STAGES, PROCESS_STAGES } from '../../data/workspace'

export default function RecordPanel({ record, onClose, children }) {
  const steps = record?.steps || (record?.module === 'memos' ? MEMO_STAGES : PROCESS_STAGES)
  const active = steps.indexOf(record?.status)
  return (
    <Dialog open={!!record} onClose={onClose} title={record?.title || 'Record details'} panel>
      {record && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{record.id}</Badge>
            <Badge
              variant={
                record.status === 'Complete' || record.status === 'Approved' ? 'success' : 'warning'
              }
            >
              {record.status}
            </Badge>
            {record.module !== 'borrowing' && <Badge variant="info">Demo record</Badge>}
          </div>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            {Object.entries({
              Company: record.company,
              'Responsible person': record.owner,
              'Due / return date': record.date && formatDate(record.date),
              'Payment route': record.route,
              'Insurance provider': record.provider,
              'Road tax expiry': record.roadTaxDate && formatDate(record.roadTaxDate),
              Amount:
                record.amount != null
                  ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(
                      record.amount
                    )
                  : null,
            })
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="mt-1 break-words font-medium">{value}</dd>
                </div>
              ))}
          </dl>
          {record.date && !['Complete', 'Returned', 'Approved'].includes(record.status) && (
            <Badge variant={urgency(record.date)}>{dueLabel(record.date)}</Badge>
          )}
          <section aria-label="Process progress">
            <h3 className="mb-4 text-sm font-semibold">Step tracker</h3>
            <ol className="space-y-3">
              {steps.map((step, i) => (
                <li
                  key={step}
                  className="flex items-center gap-3 text-sm"
                  aria-current={i === active ? 'step' : undefined}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border ${i <= active ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted'}`}
                  >
                    {i < active ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className={i === active ? 'font-semibold' : 'text-muted'}>
                    {step}
                    {i === active && <span className="sr-only"> (current step)</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <section aria-label="Approval and activity timeline">
            <h3 className="mb-4 text-sm font-semibold">Approval & activity timeline</h3>
            {record.history?.length ? (
              <ol className="space-y-4 border-l border-line pl-4">
                {record.history.map((event, i) => (
                  <li key={i}>
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                      <Clock className="h-3 w-3" />
                      {event.actor} · {formatDate(event.at)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">No approval actions recorded yet.</p>
            )}
          </section>
          {record.module !== 'borrowing' && (
            <p className="text-xs italic text-[var(--app-warning)]">
              Workflow stages and approval responsibilities [to confirm].
            </p>
          )}
          {children}
        </div>
      )}
    </Dialog>
  )
}
