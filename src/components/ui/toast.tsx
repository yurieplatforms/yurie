'use client'

import { useCallback, useState } from 'react'
import { Check, X, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/utils'

export type Toast = {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, showToast, dismissToast }
}

const toastStyles = {
  success: {
    container: 'bg-[var(--color-success)]/10 border-[var(--color-success)]/20 text-[var(--color-success)]',
    icon: 'bg-[var(--color-success)]',
  },
  error: {
    container: 'bg-[var(--color-destructive)]/10 border-[var(--color-destructive)]/20 text-[var(--color-destructive)]',
    icon: 'bg-[var(--color-destructive)]',
  },
  info: {
    container: 'bg-[var(--color-info)]/10 border-[var(--color-info)]/20 text-[var(--color-info)]',
    icon: 'bg-[var(--color-info)]',
  },
  warning: {
    container: 'bg-[var(--color-warning)]/10 border-[var(--color-warning)]/20 text-[var(--color-warning)]',
    icon: 'bg-[var(--color-warning)]',
  },
}

const ToastIcon = ({ type }: { type: Toast['type'] }) => {
  switch (type) {
    case 'success':
      return <Check className="h-3 w-3 text-white" />
    case 'error':
      return <X className="h-3 w-3 text-white" />
    case 'warning':
      return <AlertTriangle className="h-3 w-3 text-white" />
    case 'info':
      return <Info className="h-3 w-3 text-white" />
  }
}

export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={cn(
            'flex items-center gap-2.5 px-4 py-3 rounded-[var(--radius-card)] shadow-[var(--shadow-lg)] border pointer-events-auto',
            'animate-in slide-in-from-right-5 fade-in duration-300',
            toastStyles[toast.type].container
          )}
        >
          <div className={cn(
            'h-5 w-5 rounded-full flex items-center justify-center',
            toastStyles[toast.type].icon
          )}>
            <ToastIcon type={toast.type} />
          </div>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  )
}
