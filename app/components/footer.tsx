"use client"
import { usePathname } from 'next/navigation'

export default function Footer() {
  const pathname = usePathname()

  if (pathname && pathname.startsWith('/playground')) {
    return null
  }

  return (
    <footer className="mb-16 px-3 sm:px-4">
      <p className="mt-8 text-neutral-600 dark:text-neutral-300 flex items-center gap-2">
        <span>© {new Date().getFullYear()}</span>
        <img
          src="/favicon.ico"
          alt="Yurie"
          width={16}
          height={16}
          className="w-4 h-4"
          draggable={false}
        />
        <span>Yurie Platforms. All rights reserved.</span>
      </p>
    </footer>
  )
}
