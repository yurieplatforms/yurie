import './global.css'
import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Navbar } from '@/components/nav'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { baseUrl } from './sitemap'

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'Yurie',
    template: '%s | Yurie',
  },
  description: 'Yurie',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Yurie',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'Yurie',
    description: 'Yurie',
    url: baseUrl,
    siteName: 'Yurie',
    locale: 'en_US',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#191a1a' },
  ],
}

const cx = (...classes) => classes.filter(Boolean).join(' ')

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={cx(
        'bg-[#FFFFFF] text-[var(--text-primary)] dark:bg-[#191a1a]',
        GeistSans.variable,
        GeistMono.variable
      )}
    >
    <body className="font-sans antialiased">
        <div className="mx-auto max-w-3xl">
          <main className="pt-12 flex min-w-0 flex-auto flex-col px-1 sm:px-2 md:px-0">
            <Navbar />
            {children}
            <Analytics />
            <SpeedInsights />
          </main>
        </div>
      </body>
    </html>
  )
}
