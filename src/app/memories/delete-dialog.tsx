'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DeleteConfirmDialog({ 
  isOpen, 
  memoryName, 
  onConfirm, 
  onCancel,
  isDeleting 
}: { 
  isOpen: boolean
  memoryName: string
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onCancel])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />
          
          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
            className="relative w-full max-w-sm rounded-[var(--radius-dialog)] bg-[var(--color-background)] p-6 shadow-2xl border border-[var(--color-border)]"
          >
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-[var(--color-destructive)]/10 flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-[var(--color-destructive)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-foreground)] mb-2">
                Delete memory?
              </h3>
              <p className="text-sm text-[var(--color-muted-foreground)] mb-6">
                Are you sure you want to delete <span className="font-medium text-[var(--color-foreground)]">"{memoryName}"</span>? This action cannot be undone.
              </p>
              <div className="flex gap-3 w-full">
                <Button
                  onClick={onCancel}
                  disabled={isDeleting}
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={onConfirm}
                  disabled={isDeleting}
                  variant="destructive"
                  size="lg"
                  className="flex-1"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
