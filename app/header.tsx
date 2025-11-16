'use client'
import { TextEffect } from '@/components/ui/text-effect'
import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/agent', label: 'Agent' },
] as const

export function Header() {
  return (
    <header className="mb-8 flex items-center justify-between">
      <div>
        <Link href="/" className="font-medium text-black dark:text-white">
          Yurie
        </Link>
        <TextEffect
          as="p"
          preset="fade"
          per="char"
          className="text-zinc-600 dark:text-zinc-500"
          delay={0.5}
        >
          Technologies
        </TextEffect>
      </div>

      <nav className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="transition-colors hover:text-zinc-950 dark:hover:text-zinc-50"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
