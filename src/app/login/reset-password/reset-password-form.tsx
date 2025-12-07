'use client'

import { useState, useTransition } from 'react'
import { motion } from 'motion/react'
import { updatePassword } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Loader } from '@/components/ai/loader'
import { Eye, EyeOff, Lock, CheckCircle2 } from 'lucide-react'

export function ResetPasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSubmit = async (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      const result = await updatePassword(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex w-full max-w-sm flex-col gap-6"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)]/10 mb-2">
          <Lock className="h-7 w-7 text-[var(--color-primary)]" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-foreground)]">
          Set new password
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Create a strong password for your account
        </p>
      </div>

      <form action={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <Card
            variant="ghost"
            padding="sm"
            className="bg-[var(--color-destructive)]/10 text-[var(--color-destructive)] text-sm rounded-[var(--radius-card)]"
          >
            {error}
          </Card>
        )}

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                disabled={isPending}
                className="pr-10"
                minLength={6}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-transparent"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                disabled={isPending}
                className="pr-10"
                minLength={6}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-transparent"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Password requirements hint */}
          <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Password must be at least 6 characters</span>
          </div>

          <Button type="submit" disabled={isPending} size="lg" className="w-full">
            {isPending ? (
              <div className="flex items-center justify-center gap-2">
                <Loader variant="text-shimmer" size="sm" text="" />
                <span>Updating password...</span>
              </div>
            ) : (
              'Update Password'
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  )
}

