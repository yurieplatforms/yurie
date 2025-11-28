'use client'

import { usePathname } from 'next/navigation'
import { Footer } from './footer'

export function FooterWrapper() {
  const pathname = usePathname()

  // Hide the global footer on the Agent, Profile, Threads, Memories, and Home pages
  if (
    pathname?.startsWith('/profile') ||
    pathname?.startsWith('/history') ||
    pathname?.startsWith('/memories') ||
    pathname === '/' ||
    pathname === '/login'
  ) {
    return null
  }

  return <Footer />
}


