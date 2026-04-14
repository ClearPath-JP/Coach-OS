import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'
import bundleAnalyzer from '@next/bundle-analyzer'

const configDir = path.dirname(fileURLToPath(import.meta.url))

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })

// 'unsafe-eval' is required by Next.js dev server (fast refresh / HMR) but must
// not be present in production where it weakens XSS protections.
const isDev = process.env.NODE_ENV === 'development'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // 'unsafe-eval' is dev-only (HMR). 'unsafe-inline' is required in production
      // because Next.js injects inline <script> tags for hydration/data.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.upstash.io",
      "frame-src 'none'",
      // frame-ancestors overrides X-Frame-Options in modern browsers.
      // 'self' allows same-origin framing (e.g. embedded Stripe elements) while
      // blocking third-party clickjacking.
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  turbopack: {
    root: configDir,
  },
  // Keep heavy packages out of the server bundle — they're client-only
  serverExternalPackages: [
    'three',
    '@react-three/fiber',
    '@react-three/drei',
    '@splinetool/react-spline',
    '@splinetool/runtime',
    'gsap',
    'animejs',
    'lenis',
  ],
  images: {
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'drive.google.com', pathname: '/**' },
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default withBundleAnalyzer(nextConfig)
