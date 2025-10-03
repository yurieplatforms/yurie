'use client'
import { usePathname } from 'next/navigation'

export default function Footer() {
  const pathname = usePathname()

  if (pathname && (pathname === '/' || pathname.startsWith('/playground'))) {
    return null
  }

  return (
    <footer className="mb-16 px-3 sm:px-4">
      <p className="mt-8 flex items-center gap-1 text-neutral-600 dark:text-neutral-300" suppressHydrationWarning>
        <span>© {new Date().getFullYear()}</span>
        <img
          src="/favicon.ico"
          alt="Yurie"
          width={20}
          height={20}
          className="h-5 w-5 sm:h-6 sm:w-6"
          draggable={false}
          decoding="async"
        />
        <span>Yurie Platforms. All rights reserved.</span>
      </p>
    </footer>
  )
}
