import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AppLoadingScreen } from '@/components/layout/AppLoadingScreen'

export const metadata: Metadata = {
  title: 'ClearPath — Coach OS & client portal',
  description: 'Coach operating system and client portal',
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
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AppLoadingScreen />
          <div className="page-enter min-h-screen">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  )
}
