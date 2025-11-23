'use client'
import { TextEffect } from '@/components/ui/text-effect'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'

const NAV_ITEMS = [
  { href: '/agent', label: 'Agent' },
  { href: '/history', label: 'Threads' },
] as const

export function Header() {
  const pathname = usePathname()
  const { user, isLoading } = useAuth()

  return (
    <header className="mb-8 flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Link
          href="/"
          className="text-lg font-medium text-black dark:text-white"
        >
          Yurie
        </Link>
        <Link href="/">
          <TextEffect
            as="span"
            preset="fade"
            per="char"
            className="text-lg text-zinc-600 dark:text-zinc-500"
            delay={0.5}
          >
            Platforms
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
                {item.label}
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
              {user.user_metadata?.full_name
                ? user.user_metadata.full_name.split(' ')[0]
                : 'Profile'}
            </Link>
          </div>
        ) : (
          <Link
            href="/login"
            className="text-base text-zinc-500 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  )
}
