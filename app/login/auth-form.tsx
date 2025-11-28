'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { signup } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader } from '@/components/ai/loader'
import { cn } from '@/lib/utils'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { authSchema } from '@/lib/auth-schema'

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
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
          <img src="/favicon.ico" alt="Yurie" className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === 'signin' ? 'Welcome back' : 'Create an account'}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {mode === 'signin'
            ? 'Enter your email to sign in to your account'
            : 'Enter your email to create your account'}
        </p>
      </div>

      <div className="relative flex w-full items-center justify-center rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800/50">
        <div className="absolute inset-0 rounded-lg p-1">
          <motion.div
            layoutId="active-tab"
            className={cn(
              "absolute inset-y-1 w-[calc(50%-4px)] rounded-md bg-white shadow-sm dark:bg-zinc-950",
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
            "relative z-10 w-1/2 py-1.5 text-sm font-medium transition-colors duration-200 cursor-pointer",
            mode === 'signin' ? "text-zinc-950 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
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
            "relative z-10 w-1/2 py-1.5 text-sm font-medium transition-colors duration-200 cursor-pointer",
            mode === 'signup' ? "text-zinc-950 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
          )}
        >
          Sign Up
        </button>
      </div>

      <form action={handleSubmit} className="flex flex-col gap-4">
        {localError && (
          <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-500 dark:bg-red-500/20">
            {localError}
          </div>
        )}
        {message && (
          <div className="rounded-md bg-zinc-500/10 p-3 text-sm text-zinc-500 dark:bg-zinc-500/20">
            {message}
          </div>
        )}

        <div className="grid gap-4">
          <div className="grid gap-2">
            <label htmlFor="email" className="text-sm font-medium leading-none">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              required
              disabled={isPending}
              className="bg-zinc-50 border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800"
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-sm font-medium leading-none"
              >
                Password
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
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
                className="bg-zinc-50 border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
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
            className="w-full bg-[#7F91E0] text-white hover:bg-[#6B7FD6] dark:bg-[#7F91E0] dark:text-white dark:hover:bg-[#8FA0E8]"
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
      
      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
        By continuing, you agree to our{' '}
        <a href="#" className="underline hover:text-zinc-900 dark:hover:text-zinc-50">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="#" className="underline hover:text-zinc-900 dark:hover:text-zinc-50">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  )
}
