'use client'

import { usePathname } from 'next/navigation'
import { Footer } from './footer'

export function FooterWrapper() {
  const pathname = usePathname()

  // Hide the global footer on the Agent, Profile, and Home pages
  if (
    pathname?.startsWith('/agent') ||
    pathname?.startsWith('/profile') ||
    pathname === '/' ||
    pathname === '/login'
  ) {
    return null
  }

  return <Footer />
}


