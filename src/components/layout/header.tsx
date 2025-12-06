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
                    "relative rounded-[var(--radius-full)] px-3.5 py-1.5 text-base font-medium transition-all duration-[var(--transition-base)]",
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
            <div className="h-8 w-20 animate-pulse rounded-[var(--radius-full)] bg-[var(--color-surface)]" />
          ) : user ? (
            <Link
              href="/profile"
              className={cn(
                "group flex items-center gap-2 rounded-[var(--radius-full)] px-3 py-1.5 text-base font-medium transition-all duration-[var(--transition-base)]",
                pathname === '/profile'
                  ? "bg-[var(--color-surface-hover)] text-[var(--color-foreground)]"
                  : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)] active:bg-[var(--color-surface-active)]"
              )}
            >
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="Profile"
                  className="h-5 w-5 rounded-full object-cover ring-1 ring-[var(--color-border)] transition-all group-hover:ring-[var(--color-accent)]/30"
                />
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] text-[10px] font-semibold text-white">
                  {(user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <TextEffect as="span" preset="fade" per="char">
                {user.user_metadata?.full_name
                  ? user.user_metadata.full_name.split(' ')[0]
                  : 'Profile'}
              </TextEffect>
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
