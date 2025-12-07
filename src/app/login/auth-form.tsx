'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { signup } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Loader } from '@/components/ai/loader'
import { cn } from '@/lib/utils'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { authSchema } from '@/lib/supabase/auth-schema'

export function AuthForm({
  message,
  error,
}: {
  message?: string
  error?: string
}) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [isPending, startTransition] = useTransition()
  const [localError, setLocalError] = useState<string | null>(error || null)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const handleSubmit = async (formData: FormData) => {
    setLocalError(null)
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
      } else {
        const result = await signup(formData)
        if (result?.error) {
          setLocalError(result.error)
        }
      }
    })
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-foreground)]">
          {mode === 'signin' ? 'Welcome back' : 'Create an account'}
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {mode === 'signin'
            ? 'Enter your email to log in to your account'
            : 'Enter your email to create your account'}
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="relative flex w-full items-center justify-center rounded-[var(--radius-input)] bg-[var(--color-surface)] border border-[var(--color-input-border)] p-1">
        <div className="absolute inset-0 rounded-[var(--radius-input)] p-1">
          <motion.div
            layoutId="active-tab"
            className={cn(
              "absolute inset-y-1 w-[calc(50%-4px)] rounded-[calc(var(--radius-input)-4px)] bg-[var(--color-primary)] shadow-sm",
              mode === 'signup' ? "left-[50%]" : "left-1"
            )}
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          />
        </div>
        <button
          onClick={() => {
            setMode('signin')
            setLocalError(null)
          }}
          className={cn(
            "relative z-10 w-1/2 py-1.5 text-sm font-semibold transition-colors duration-[var(--transition-base)] cursor-pointer",
            mode === 'signin' ? "text-white" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          )}
        >
          Log in
        </button>
        <button
          onClick={() => {
            setMode('signup')
            setLocalError(null)
          }}
          className={cn(
            "relative z-10 w-1/2 py-1.5 text-sm font-semibold transition-colors duration-[var(--transition-base)] cursor-pointer",
            mode === 'signup' ? "text-white" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          )}
        >
          Sign up
        </button>
      </div>

      <form action={handleSubmit} className="flex flex-col gap-4">
        {localError && (
          <Card variant="ghost" padding="sm" className="bg-[var(--color-destructive)]/10 text-[var(--color-destructive)] text-sm rounded-[var(--radius-card)]">
            {localError}
          </Card>
        )}
        {message && (
          <Card variant="default" padding="sm" className="text-sm text-[var(--color-muted-foreground)] rounded-[var(--radius-card)]">
            {message}
          </Card>
        )}

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              required
              disabled={isPending}
            />
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">
                Password
              </Label>
              {mode === 'signin' && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] hover:no-underline"
                  onClick={() => alert("Password reset not implemented yet.")}
                >
                  Forgot password?
                </Button>
              )}
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                disabled={isPending}
                className="pr-10"
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
          
          <Button 
            type="submit" 
            disabled={isPending}
            size="lg"
            className="w-full"
          >
            {isPending ? (
              <div className="flex items-center justify-center gap-2">
                <Loader variant="text-shimmer" size="sm" text="" />
                <span>{mode === 'signin' ? 'Logging in...' : 'Creating Account...'}</span>
              </div>
            ) : (
              mode === 'signin' ? 'Log in' : 'Create Account'
            )}
          </Button>
        </div>
      </form>
      
      <p className="text-center text-xs text-[var(--color-muted-foreground)]">
        By continuing, you agree to our{' '}
        <a href="#" className="underline hover:text-[var(--color-primary)] transition-colors">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="#" className="underline hover:text-[var(--color-primary)] transition-colors">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  )
}
