import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import 'katex/dist/katex.min.css'
import './globals.css'
import { Header } from '@/components/layout/header'
import { FooterWrapper } from '@/components/layout/footer-wrapper'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/lib/providers/auth-provider'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f5' },
    { media: '(prefers-color-scheme: dark)', color: '#262624' },
  ],
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://yurie-fawn.vercel.app/'),
  alternates: {
    canonical: '/',
  },
  title: {
    default: 'Yurie',
    template: '%s | Yurie',
  },
  description:
    'Yurie is a free and open-source personal website template built with Next.js 15, React 19 and Motion-Primitives.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Yurie',
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
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Zalando+Sans+Expanded:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${geist.variable} ${geistMono.variable} bg-[var(--color-background)] text-[var(--color-foreground)] antialiased`}
        style={{
          fontSize: 'var(--font-size-base)',
          lineHeight: 'var(--line-height-normal)',
          letterSpacing: 'var(--tracking-tight)',
        }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <div className="flex min-h-screen w-full flex-col font-sans">
              <Header />
              <div className="relative mx-auto w-full max-w-2xl flex-1 px-4 pt-24">
                {children}
                <FooterWrapper />
              </div>
            </div>
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
