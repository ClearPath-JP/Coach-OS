export const dynamic = 'force-dynamic'

import type { Metadata, Viewport } from 'next'
import { DM_Sans, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AppLoadingScreen } from '@/components/layout/AppLoadingScreen'

// Dojo Arcade type: Space Grotesk (display) + DM Sans (body). Loaded into the
// same CSS variables the app already consumes, so the whole tree re-typesets.
const instrumentSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const shipporiMincho = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
          <AppLoadingScreen />
          <div className="page-enter min-h-screen">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  )
}
