import { useEffect, useRef } from 'react'
import Button from './Button'

export default function ConfirmDialog({ open, onContinue, onDiscard }) {
  const continueRef = useRef(null)

  useEffect(() => {
    if (open) continueRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-title"
      aria-describedby="unsaved-changes-message"
    >
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-2xl">
        <h2 id="unsaved-changes-title" className="text-lg font-semibold">Unsaved changes</h2>
        <p id="unsaved-changes-message" className="mt-2 text-sm text-muted">
          You have unsaved changes. Are you sure you want to close this form?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={continueRef} variant="outline" onClick={onContinue}>
            Continue Editing
          </Button>
          <Button variant="teal" onClick={onDiscard}>
            Discard Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
