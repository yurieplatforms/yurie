import './global.css'
import type { Metadata, Viewport } from 'next'
import { Inter, Roboto_Mono } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], variable: '--font-geist-sans' })
const mono = Roboto_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
import { Analytics } from '@vercel/analytics/react'
import { baseUrl } from './sitemap'
import Script from 'next/script'
import { cn } from './lib/utils'

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
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#212121' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={cn(
        'text-black bg-white dark:text-white dark:bg-[#212121]',
        inter.variable,
        mono.variable
      )}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased overflow-hidden h-screen flex flex-col">
        {/* auto-sync dark mode with system preference (runs before interactive) */}
        <Script id="theme-sync" strategy="beforeInteractive">{`try{var m=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)');var d=document.documentElement;var set=()=>{m.matches?d.classList.add('dark'):d.classList.remove('dark')};set();m&&m.addEventListener&&m.addEventListener('change',set);}catch(e){}`}</Script>
        <main className="flex-auto min-w-0 flex flex-col overflow-hidden w-full max-w-[52rem] mx-auto px-2 sm:px-4 mt-2 md:mt-4">
          {children}
          <Analytics />
        </main>
      </body>
    </html>
  )
}
