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
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface)]">
          <img src="/favicon.ico" alt="Yurie" className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-foreground)]">
          {mode === 'signin' ? 'Welcome back' : 'Create an account'}
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {mode === 'signin'
            ? 'Enter your email to sign in to your account'
            : 'Enter your email to create your account'}
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="relative flex w-full items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-surface)] p-1">
        <div className="absolute inset-0 rounded-[var(--radius-full)] p-1">
          <motion.div
            layoutId="active-tab"
            className={cn(
              "absolute inset-y-1 w-[calc(50%-4px)] rounded-[var(--radius-full)] bg-[var(--color-background)] shadow-sm",
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
            "relative z-10 w-1/2 py-1.5 text-sm font-medium transition-colors duration-[var(--transition-base)] cursor-pointer",
            mode === 'signin' ? "text-[var(--color-foreground)]" : "text-[var(--color-muted-foreground)]"
          )}
        >
          Sign In
        </button>
        <button
          onClick={() => {
            setMode('signup')
            setLocalError(null)
          }}
          className={cn(
            "relative z-10 w-1/2 py-1.5 text-sm font-medium transition-colors duration-[var(--transition-base)] cursor-pointer",
            mode === 'signup' ? "text-[var(--color-foreground)]" : "text-[var(--color-muted-foreground)]"
          )}
        >
          Sign Up
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
                <button
                  type="button"
                  className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
                  onClick={() => alert("Password reset not implemented yet.")}
                >
                  Forgot password?
                </button>
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
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
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
                <span>{mode === 'signin' ? 'Signing In...' : 'Creating Account...'}</span>
              </div>
            ) : (
              mode === 'signin' ? 'Sign In' : 'Create Account'
            )}
          </Button>
        </div>
      </form>
      
      <p className="text-center text-xs text-[var(--color-muted-foreground)]">
        By continuing, you agree to our{' '}
        <a href="#" className="underline hover:text-[var(--color-accent)] transition-colors">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="#" className="underline hover:text-[var(--color-accent)] transition-colors">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  )
}
