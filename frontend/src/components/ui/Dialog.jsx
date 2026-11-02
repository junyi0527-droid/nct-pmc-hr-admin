import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import Button from './Button'

/** Native dialogs provide focus containment, Escape handling and focus restore. */
export default function Dialog({
  open,
  onClose,
  title,
  children,
  panel = false,
  navigation = false,
}) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.querySelector('[data-autofocus]')?.focus()
    }
    if (!open && dialog.open) dialog.close()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [open])
  return (
    <dialog
      ref={ref}
      data-side={navigation ? 'left' : 'right'}
      className={panel || navigation ? 'ui-panel' : 'ui-modal'}
      style={
        navigation ? { left: 0, right: 'auto', margin: 0, width: 'min(18rem, 90vw)' } : undefined
      }
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="flex h-full max-h-[inherit] flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line p-5">
          <h2 className="font-semibold">{title}</h2>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label={`Close ${title}`}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </dialog>
  )
}
