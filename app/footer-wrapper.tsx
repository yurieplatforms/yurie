'use client'

import { usePathname } from 'next/navigation'
import { Footer } from './footer'

export function FooterWrapper() {
  const pathname = usePathname()

  // Hide the global footer on the Agent page (and any nested Agent routes)
  if (pathname?.startsWith('/agent')) {
    return null
  }

  return <Footer />
}


