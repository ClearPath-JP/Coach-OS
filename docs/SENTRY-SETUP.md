# Sentry — error & performance monitoring

Sentry is **wired but inert** until you add the DSN env vars. No errors are sent and the SDK is a no-op until then. Wiring lives in `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, and the `withSentryConfig` wrap in `next.config.ts`.

## To turn it on (do this tomorrow)
1. Create a project at https://sentry.io (platform: **Next.js**). Copy the **DSN**.
2. Add these env vars in Vercel (Production + Preview) — `vercel env add`:
   - `SENTRY_DSN` = the DSN (server/edge error capture)
   - `NEXT_PUBLIC_SENTRY_DSN` = the **same** DSN (browser error capture)
3. (Optional — source maps so stack traces are readable) add all three, then redeploy:
   - `SENTRY_ORG` = your Sentry org slug
   - `SENTRY_PROJECT` = your Sentry project slug
   - `SENTRY_AUTH_TOKEN` = a Sentry auth token with `project:releases` scope
   Without these three, Sentry still captures errors — only the source-map upload is skipped.
4. Redeploy (`vercel --prod`). Trigger a test error to confirm it lands in Sentry.

## Notes
- Sampling: 10% traces in prod. Session Replay is intentionally **not** enabled (heavier + privacy-sensitive) — add `Sentry.replayIntegration()` to `instrumentation-client.ts` later if you want it.
- The in-app admin error feed (`/admin` → error logs) is independent of Sentry and works without any of the above.
