export const dynamic = 'force-dynamic'

import type { Metadata, Viewport } from 'next'
import { Instrument_Sans, Shippori_Mincho } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AppLoadingScreen } from '@/components/layout/AppLoadingScreen'
import { KatanaOpening } from '@/components/opening/KatanaOpening'

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const shipporiMincho = Shippori_Mincho({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Korva — Coaching platform & client portal',
  description: 'The coaching platform for martial arts and strength conditioning.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="dark" className={`${instrumentSans.variable} ${shipporiMincho.variable}`}>
      <body className="antialiased">
        <ThemeProvider>
          <KatanaOpening />
          <AppLoadingScreen />
          <div className="page-enter min-h-screen">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  )
}
