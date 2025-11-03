import './global.css'
import type { Metadata, Viewport } from 'next'
import { Inter, Roboto_Mono } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], variable: '--font-geist-sans' })
const mono = Roboto_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
import { Analytics } from '@vercel/analytics/react'
import { baseUrl } from './sitemap'
import Script from 'next/script'
import { cn } from './lib/utils'
import { Sidebar, SidebarBody } from './components/ui/sidebar'
import { HistoryList } from './components/ui/history-list'
import { SidebarBrand } from './components/ui/sidebar-brand'

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
      <body className="font-sans antialiased overflow-hidden h-screen flex">
        {/* auto-sync dark mode with system preference (runs before interactive) */}
        <Script id="theme-sync" strategy="beforeInteractive">{`try{var m=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)');var d=document.documentElement;var set=()=>{m.matches?d.classList.add('dark'):d.classList.remove('dark')};set();m&&m.addEventListener&&m.addEventListener('change',set);}catch(e){}`}</Script>
        <div className="flex flex-1 w-full">
          <Sidebar>
            <SidebarBody className="justify-between gap-10">
              <div className="flex flex-col flex-1 overflow-y-auto">
                <SidebarBrand />
                <div className="mt-3 border-t border-neutral-200 dark:border-neutral-700 hidden md:block" />
                <div className="mt-4 flex flex-col gap-2">
                  <HistoryList />
                </div>
              </div>
              
            </SidebarBody>
          </Sidebar>
          <main className="flex-auto min-w-0 flex flex-col overflow-hidden w-full pt-[calc(3rem+env(safe-area-inset-top)+16px)] md:pt-0 md:mt-4">
            {children}
            <Analytics />
          </main>
        </div>
      </body>
    </html>
  )
}
