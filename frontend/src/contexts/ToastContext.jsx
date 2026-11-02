import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import Button from '../components/ui/Button'

const ToastContext = createContext(null)
function Toast({ toast, dismiss }) {
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const timer = setTimeout(() => dismiss(toast.id), 12000)
    return () => clearTimeout(timer)
  }, [toast.id, dismiss, paused])
  return (
    <div
      className="ui-card flex items-start gap-3 p-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false)
      }}
    >
      <Check className="mt-1 h-4 w-4 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="text-sm">{toast.message}</p>
        {toast.undo && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1"
            onClick={() => {
              toast.undo()
              dismiss(toast.id)
            }}
          >
            Undo
          </Button>
        )}
      </div>
      <Button
        size="sm"
        variant="ghost"
        aria-label="Dismiss message"
        onClick={() => dismiss(toast.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const dismiss = useCallback(
    (id) => setToasts((items) => items.filter((item) => item.id !== id)),
    []
  )
  const notify = useCallback(
    (message, undo) =>
      setToasts((items) => [...items, { id: crypto.randomUUID(), message, undo }].slice(-3)),
    []
  )
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] w-[min(24rem,calc(100%-2rem))] space-y-2 [&>*]:pointer-events-auto"
        role="status"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} dismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
export const useToast = () => useContext(ToastContext)
