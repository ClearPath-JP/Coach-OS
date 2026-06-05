import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'
import bundleAnalyzer from '@next/bundle-analyzer'
import { withSentryConfig } from '@sentry/nextjs'

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
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
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
      // *.b-cdn.net = Bunny CDN: video thumbnails (img) + MP4 fallback previews (media).
      "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://*.b-cdn.net",
      "media-src 'self' https://*.supabase.co blob: https://*.b-cdn.net",
      // video.bunnycdn.com = Bunny Stream TUS upload; *.b-cdn.net = Bunny CDN (captions/mp4).
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.upstash.io https://video.bunnycdn.com https://*.b-cdn.net",
      // iframe.mediadelivery.net = Bunny Stream embedded player.
      "frame-src https://iframe.mediadelivery.net",
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
    // Remotion Lambda client (pulls in the AWS SDK) — load at runtime, don't bundle.
    '@remotion/lambda',
    '@remotion/lambda-client',
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

// withSentryConfig wraps at build time (source maps, Turbopack rules).
// Runtime init is a no-op until SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN are set.
// Conditionally apply only when source-map upload credentials are present;
// the runtime Sentry.init (instrumentation.ts + instrumentation-client.ts)
// is always active regardless of this wrapper.
const sentryOrg = process.env.SENTRY_ORG
const sentryProject = process.env.SENTRY_PROJECT
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN

const withAnalyzer = withBundleAnalyzer(nextConfig)

const finalConfig = sentryOrg && sentryProject && sentryAuthToken
  ? withSentryConfig(withAnalyzer, {
      org: sentryOrg,
      project: sentryProject,
      authToken: sentryAuthToken,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      disableLogger: true,
    })
  : withSentryConfig(withAnalyzer, {
      silent: true,
      disableLogger: true,
    })

export default finalConfig
