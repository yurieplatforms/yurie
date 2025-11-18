import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Header } from './header'
import { FooterWrapper } from './footer-wrapper'
import { ThemeProvider } from 'next-themes'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://yurie-fawn.vercel.app/'),
  alternates: {
    canonical: '/',
  },
  title: {
    default: 'Yurie Platforms',
    template: '%s | Yurie Platforms',
  },
  description:
    'Yurie Platforms is a free and open-source personal website template built with Next.js 15, React 19 and Motion-Primitives.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
}

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geist.variable} ${geistMono.variable} bg-white tracking-tight antialiased dark:bg-zinc-950`}
      >
        <ThemeProvider
          enableSystem={true}
          attribute="class"
          storageKey="theme"
          defaultTheme="system"
        >
          <div className="flex min-h-screen w-full flex-col font-[family-name:var(--font-inter-tight)]">
            <div className="relative mx-auto flex w-full max-w-screen-sm flex-1 flex-col px-4 pt-10 min-h-0">
              <Header />
              {children}
              <FooterWrapper />
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
