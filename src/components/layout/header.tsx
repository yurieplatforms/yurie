'use client'
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

  return (
    <header className="fixed left-0 right-0 top-0 z-50 bg-[var(--color-background)]" suppressHydrationWarning>
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4" suppressHydrationWarning>
        <div className="flex items-center gap-1.5">
          <Link href="/" className="group flex items-center gap-2">
            <TextEffect
              as="span"
              preset="fade"
              per="char"
              className="font-zalando text-lg text-[var(--color-foreground)]"
            >
              yurie
            </TextEffect>
          </Link>
        </div>

        <div className="flex items-center gap-1" suppressHydrationWarning>
          <nav className="flex items-center gap-0.5 text-sm" suppressHydrationWarning>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative inline-flex items-center justify-center rounded-[var(--radius-full)] h-8 px-3 text-sm font-medium transition-all duration-[var(--transition-base)]",
                    isActive
                      ? "bg-[var(--color-surface-hover)] text-[var(--color-foreground)]"
                      : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)] active:bg-[var(--color-surface-active)]"
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
                "group relative inline-flex items-center justify-center rounded-full h-10 w-10 transition-all duration-[var(--transition-base)]",
                pathname === '/profile'
                  ? "ring-1 ring-primary ring-offset-2 ring-offset-[var(--color-background)]"
                  : "hover:opacity-80"
              )}
            >
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="Profile"
                  className="h-full w-full rounded-full object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-info)]" />
              )}
            </Link>
          ) : (
            <Button asChild size="sm" className="text-sm">
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
