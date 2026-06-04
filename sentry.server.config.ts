import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV ?? 'development',
})
