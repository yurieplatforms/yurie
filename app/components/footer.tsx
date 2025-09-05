"use client"
import { usePathname } from 'next/navigation'

export default function Footer() {
  const pathname = usePathname()

  if (pathname && pathname.startsWith('/playground')) {
    return null
  }

  return (
    <footer className="mb-16 pl-4 pr-4">
      <p className="mt-8 text-neutral-600 dark:text-neutral-300">
        © {new Date().getFullYear()} Yurie. All rights reserved.
      </p>
    </footer>
  )
}
