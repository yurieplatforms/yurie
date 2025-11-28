'use client'
import { TextEffect } from '@/components/ui/text-effect'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'

const NAV_ITEMS = [
  { href: '/history', label: 'Threads' },
  { href: '/memories', label: 'Memories' },
] as const

export function Header() {
  const pathname = usePathname()
  const { user, isLoading } = useAuth()

  return (
    <header className="fixed left-0 right-0 top-0 z-50 bg-white dark:bg-black">
      <div className="mx-auto flex h-16 max-w-screen-sm items-center justify-between px-4">
        <div className="flex items-center gap-1.5">
          <Link href="/" className="group flex items-center gap-2">
            <TextEffect
              as="span"
              preset="fade"
              per="char"
              className="font-zalando text-lg text-black dark:text-white"
            >
              yurie
            </TextEffect>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-4 text-base text-zinc-500 dark:text-zinc-400">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`transition-colors ${
                    isActive
                      ? 'text-zinc-950 dark:text-zinc-50'
                      : 'hover:text-zinc-950 dark:hover:text-zinc-50'
                  }`}
                >
                  <TextEffect as="span" preset="fade" per="char">
                    {item.label}
                  </TextEffect>
                </Link>
              )
            })}
          </nav>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />

          {isLoading ? (
            <div className="h-5 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          ) : user ? (
            <div className="flex items-center gap-4">
              <Link
                href="/profile"
                className={`flex items-center gap-2 text-base transition-colors ${
                  pathname === '/profile'
                    ? 'text-zinc-950 dark:text-zinc-50'
                    : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50'
                }`}
              >
                {user.user_metadata?.avatar_url && (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Profile"
                    className="h-5 w-5 rounded-full object-cover"
                  />
                )}
                <TextEffect as="span" preset="fade" per="char">
                  {user.user_metadata?.full_name
                    ? user.user_metadata.full_name.split(' ')[0]
                    : 'Profile'}
                </TextEffect>
              </Link>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-base text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              <TextEffect as="span" preset="fade" per="char">
                Log in
              </TextEffect>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
