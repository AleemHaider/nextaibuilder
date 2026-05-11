// Lightweight toast primitive. Renders one toast that self-dismisses after
// 3.5s. Pair with the `useToast` hook to drive a stack from any page.
//
// Pattern: `const { toasts, addToast, dismissToast } = useToast()` then render
// `{toasts.map((t) => <Toast key={t.id} toast={t} onDismiss={dismissToast} />)}`
// inside a fixed-position container.

import { useCallback, useEffect, useState } from 'react'
import { cn } from '../../lib/utils'

export interface ToastMessage {
  id: string
  message: string
  variant: 'success' | 'error'
}

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastMessage
  onDismiss: (id: string) => void
}) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 3500)
    return () => clearTimeout(t)
  }, [toast.id, onDismiss])
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-3 px-5 py-3.5 rounded-[14px] shadow-[rgba(26,39,68,0.2)_0_4px_20px] text-[14px] font-semibold',
        toast.variant === 'success'
          ? 'bg-[#e6f4ec] text-[#054d28] border border-[rgba(5,77,40,0.15)]'
          : 'bg-[#fdeaeb] text-[#d03238] border border-[rgba(208,50,56,0.15)]',
      )}
    >
      <span aria-hidden="true">{toast.variant === 'success' ? '✓' : '✗'}</span>
      {toast.message}
    </div>
  )
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const addToast = useCallback((message: string, variant: 'success' | 'error') => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), message, variant }])
  }, [])
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])
  return { toasts, addToast, dismissToast }
}
