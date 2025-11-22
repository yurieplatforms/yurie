'use client'
import { TextEffect } from '@/components/ui/text-effect'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/agent', label: 'Agent' },
  { href: '/history', label: 'Threads' },
] as const

export function Header() {
  const pathname = usePathname()

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
    </header>
  )
}
