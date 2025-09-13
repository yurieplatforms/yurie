import './global.css'
import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Navbar } from './components/nav'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import Footer from './components/footer'
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
    icon: '/favicon.ico?v=3',
    shortcut: '/favicon.ico?v=3',
    apple: '/favicon.ico?v=3',
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
    { media: '(prefers-color-scheme: light)', color: '#E7E7EB' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0A' },
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
        'text-[var(--text-primary)] bg-[#E7E7EB] dark:bg-[#0A0A0A]',
        GeistSans.variable,
        GeistMono.variable
      )}
    >
      <body className="font-sans antialiased max-w-3xl mx-auto mt-8">
        <main className="flex-auto min-w-0 mt-6 flex flex-col px-1 sm:px-2 md:px-0">
          <Navbar />
          {children}
          <Footer />
          <Analytics />
          <SpeedInsights />
        </main>
      </body>
    </html>
  )
}