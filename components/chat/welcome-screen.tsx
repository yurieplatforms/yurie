'use client'

import { useAuth } from '@/components/providers/auth-provider'

export function WelcomeScreen() {
  const { user } = useAuth()
  const fullName = user?.user_metadata?.full_name ?? user?.user_metadata?.name
  const firstName = fullName?.split(' ')[0]

  return (
    <div className="mt-auto text-center">
      <div className="text-2xl font-medium">
        {firstName ? `Hello, ${firstName}` : 'Hi there'}
      </div>
    </div>
  )
}

