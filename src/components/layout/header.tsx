'use client'
import { useState, useEffect, useCallback } from 'react'
import { TextEffect } from '@/components/ui/text-effect'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/history', label: 'Threads' },
] as const

export function Header() {
  const pathname = usePathname()
  const { user, isLoading } = useAuth()
  const [avatarError, setAvatarError] = useState(false)
  
  // Reset error state when user changes
  useEffect(() => {
    setAvatarError(false)
  }, [user?.user_metadata?.avatar_url])

  // Handle logo click - stops AI response and navigates to home
  const handleLogoClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    // Hard navigation aborts any pending fetch requests and resets state
    window.location.href = '/'
  }, [])

  return (
    <header className="fixed left-0 right-0 top-0 z-50 bg-[var(--color-background)]" suppressHydrationWarning>
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4" suppressHydrationWarning>
        <div className="flex items-center gap-1.5">
          <a 
            href="/" 
            onClick={handleLogoClick}
            className="group flex items-center gap-2 cursor-pointer"
          >
            <TextEffect
              as="span"
              preset="fade"
              per="char"
              className="font-zalando text-lg text-[var(--color-foreground)]"
            >
              yurie
            </TextEffect>
          </a>
        </div>

        <div className="flex items-center gap-1" suppressHydrationWarning>
          <nav className="flex items-center gap-0.5" suppressHydrationWarning>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative inline-flex items-center justify-center rounded-[var(--radius-full)] h-8 px-3.5 text-[var(--font-size-sm)] font-medium tracking-normal transition-all duration-[var(--transition-base)]",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent"
                  )}
                >
                  <TextEffect as="span" preset="fade" per="char">
                    {item.label}
                  </TextEffect>
                </Link>
              )
            })}
          </nav>

          <div className="mx-2 h-4 w-px bg-[var(--color-border)]" />

          {isLoading ? (
            <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--color-surface)]" />
          ) : user ? (
            <Link
              href="/profile"
              className={cn(
                "avatar-ring group relative inline-flex items-center justify-center rounded-full h-10 w-10 transition-all duration-[var(--transition-base)]",
                pathname === '/profile' && "active"
              )}
            >
              {user.user_metadata?.avatar_url && 
               typeof user.user_metadata.avatar_url === 'string' && 
               user.user_metadata.avatar_url.startsWith('http') && 
               !avatarError ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="Profile"
                  className="h-full w-full rounded-full object-cover shadow-sm"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div className="h-full w-full rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-info)] shadow-sm" />
              )}
            </Link>
          ) : (
            <Button asChild size="sm" className="text-[var(--font-size-sm)] font-medium tracking-normal">
              <Link href="/login">
                <TextEffect as="span" preset="fade" per="char">
                  Log in
                </TextEffect>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
