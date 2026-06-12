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
  metadataBase: new URL('https://korvacoach.com'),
  title: {
    default: 'Korva — All-in-one software for martial arts & fitness coaches',
    template: '%s · Korva',
  },
  description:
    'Scheduling, classes, payments, belts, and video in one platform built for solo martial-arts and fitness coaches. Run your whole practice — and get paid — from one place.',
  applicationName: 'Korva',
  keywords: [
    'martial arts coaching software',
    'fitness coaching platform',
    'dojo management software',
    'solo coach app',
    'class booking software',
    'coaching CRM',
    'jiu jitsu gym software',
  ],
  authors: [{ name: 'Korva' }],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Korva',
    title: 'Korva — All-in-one software for martial arts & fitness coaches',
    description:
      'Run your whole coaching practice from one place — scheduling, classes, payments, belts, and video.',
    url: 'https://korvacoach.com',
    images: [
      { url: '/og.png', width: 1200, height: 630, alt: 'Korva — run your whole coaching practice from one place' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Korva — All-in-one software for martial arts & fitness coaches',
    description:
      'Run your whole coaching practice from one place — scheduling, classes, payments, belts, and video.',
    images: ['/og.png'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#faf7f0',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="dark" className={`${instrumentSans.variable} ${shipporiMincho.variable}`}>
      <body className="antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[300] focus:rounded-md focus:border-2 focus:border-[var(--ink)] focus:bg-[var(--bg-app)] focus:px-4 focus:py-2 focus:font-semibold focus:text-[var(--ink)] focus:shadow-lg"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <AppLoadingScreen />
          <div className="page-enter min-h-screen">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  )
}
