'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { signup, resetPassword, signInWithGoogle } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Loader } from '@/components/ai/loader'
import { cn } from '@/lib/utils'
import { Eye, EyeOff, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { authSchema, emailSchema } from '@/lib/supabase/auth-schema'

type AuthMode = 'signin' | 'signup' | 'forgot-password'

export function AuthForm({
  message,
  error,
}: {
  message?: string
  error?: string
}) {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [isPending, startTransition] = useTransition()
  const [isGooglePending, setIsGooglePending] = useState(false)
  const [localError, setLocalError] = useState<string | null>(error || null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const handleSubmit = async (formData: FormData) => {
    setLocalError(null)
    setSuccessMessage(null)

    startTransition(async () => {
      if (mode === 'signin') {
        const supabase = createClient()
        const data = {
          email: formData.get('email') as string,
          password: formData.get('password') as string,
        }

        const validated = authSchema.safeParse(data)
        if (!validated.success) {
          setLocalError(validated.error.issues[0].message)
          return
        }

        const { error } = await supabase.auth.signInWithPassword(data)
        if (error) {
          setLocalError(error.message)
          return
        }

        router.refresh()
        router.push('/')
      } else if (mode === 'signup') {
        const result = await signup(formData)
        if (result?.error) {
          setLocalError(result.error)
        }
      } else if (mode === 'forgot-password') {
        const email = formData.get('email') as string
        const validated = emailSchema.safeParse({ email })
        if (!validated.success) {
          setLocalError(validated.error.issues[0].message)
          return
        }

        const result = await resetPassword(formData)
        if (result?.error) {
          setLocalError(result.error)
        } else if (result?.success) {
          setSuccessMessage(result.message || 'Check your email for the reset link')
        }
      }
    })
  }

  const handleGoogleSignIn = async () => {
    setLocalError(null)
    setIsGooglePending(true)
    try {
      const result = await signInWithGoogle()
      if (result?.error) {
        setLocalError(result.error)
      }
    } catch {
      setLocalError('Failed to initiate Google sign in')
    } finally {
      setIsGooglePending(false)
    }
  }

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode)
    setLocalError(null)
    setSuccessMessage(null)
  }

  const getTitle = () => {
    switch (mode) {
      case 'signin':
        return 'Welcome back'
      case 'signup':
        return 'Create an account'
      case 'forgot-password':
        return 'Reset password'
    }
  }

  const getSubtitle = () => {
    switch (mode) {
      case 'signin':
        return 'Enter your email to log in to your account'
      case 'signup':
        return 'Enter your email to create your account'
      case 'forgot-password':
        return "We'll send you a link to reset your password"
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center gap-2 text-center"
        >
          {mode === 'forgot-password' && (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)]/10 mb-2">
              <Mail className="h-7 w-7 text-[var(--color-primary)]" />
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-foreground)]">
            {getTitle()}
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {getSubtitle()}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Tab Switcher - only show for signin/signup */}
      {mode !== 'forgot-password' && (
        <div className="relative flex w-full items-center justify-center rounded-[var(--radius-input)] bg-[var(--color-surface)] border border-[var(--color-input-border)] p-1">
          <div className="absolute inset-0 rounded-[var(--radius-input)] p-1">
            <motion.div
              layoutId="active-tab"
              className={cn(
                'absolute inset-y-1 w-[calc(50%-4px)] rounded-[calc(var(--radius-input)-4px)] bg-[var(--color-primary)] shadow-sm',
                mode === 'signup' ? 'left-[50%]' : 'left-1'
              )}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          </div>
          <button
            onClick={() => switchMode('signin')}
            className={cn(
              'relative z-10 w-1/2 py-1.5 text-sm font-semibold transition-colors duration-[var(--transition-base)] cursor-pointer',
              mode === 'signin'
                ? 'text-white'
                : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
            )}
          >
            Log in
          </button>
          <button
            onClick={() => switchMode('signup')}
            className={cn(
              'relative z-10 w-1/2 py-1.5 text-sm font-semibold transition-colors duration-[var(--transition-base)] cursor-pointer',
              mode === 'signup'
                ? 'text-white'
                : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
            )}
          >
            Sign up
          </button>
        </div>
      )}

      {/* Back button for forgot password */}
      {mode === 'forgot-password' && (
        <button
          onClick={() => switchMode('signin')}
          className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors self-start"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </button>
      )}

      <form action={handleSubmit} className="flex flex-col gap-4">
        {localError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card
              variant="ghost"
              padding="sm"
              className="bg-[var(--color-destructive)]/10 text-[var(--color-destructive)] text-sm rounded-[var(--radius-card)]"
            >
              {localError}
            </Card>
          </motion.div>
        )}
        {(message || successMessage) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card
              variant="default"
              padding="sm"
              className="flex items-center gap-2 text-sm text-[var(--color-success)] bg-[var(--color-success)]/10 rounded-[var(--radius-card)]"
            >
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              {successMessage || message}
            </Card>
          </motion.div>
        )}

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              required
              disabled={isPending}
              autoComplete="email"
            />
          </div>

          {mode !== 'forgot-password' && (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === 'signin' && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] hover:no-underline"
                    onClick={() => switchMode('forgot-password')}
                  >
                    Forgot password?
                  </Button>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isPending}
                  className="pr-10"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
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
              {mode === 'signup' && (
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  Must be at least 6 characters
                </p>
              )}
            </div>
          )}

          <Button type="submit" disabled={isPending || isGooglePending} size="lg" className="w-full">
            {isPending ? (
              <div className="flex items-center justify-center gap-2">
                <Loader variant="text-shimmer" size="sm" text="" />
                <span>
                  {mode === 'signin'
                    ? 'Logging in...'
                    : mode === 'signup'
                      ? 'Creating Account...'
                      : 'Sending link...'}
                </span>
              </div>
            ) : mode === 'signin' ? (
              'Log in'
            ) : mode === 'signup' ? (
              'Create Account'
            ) : (
              'Send reset link'
            )}
          </Button>
        </div>
      </form>

      {/* OAuth Divider & Buttons - only show for signin/signup */}
      {mode !== 'forgot-password' && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[var(--color-border)]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[var(--color-background)] px-2 text-[var(--color-muted-foreground)]">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full gap-3"
            onClick={handleGoogleSignIn}
            disabled={isPending || isGooglePending}
          >
            {isGooglePending ? (
              <div className="flex items-center justify-center gap-2">
                <Loader variant="text-shimmer" size="sm" text="" />
                <span>Connecting...</span>
              </div>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </Button>
        </>
      )}

      <p className="text-center text-xs text-[var(--color-muted-foreground)]">
        By continuing, you agree to our{' '}
        <a
          href="#"
          className="underline hover:text-[var(--color-primary)] transition-colors"
        >
          Terms of Service
        </a>{' '}
        and{' '}
        <a
          href="#"
          className="underline hover:text-[var(--color-primary)] transition-colors"
        >
          Privacy Policy
        </a>
        .
      </p>
    </div>
  )
}
