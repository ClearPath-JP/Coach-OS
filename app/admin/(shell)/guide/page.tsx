import type { ReactNode } from 'react'
import Link from 'next/link'
import { AdminGuideLink } from '@/components/admin/AdminGuideLink'

const nav = [
  ['#quick-start', 'Quick start'],
  ['#sidebar', 'What each menu item does'],
  ['#words', 'Words you will see'],
  ['#config', 'Where configuration lives'],
  ['#when-things-break', 'When something looks wrong'],
  ['#access', 'Who can open admin'],
] as const

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-8 border-b border-slate-200 pb-10 last:border-0">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-4 max-w-none space-y-3 text-sm leading-relaxed text-slate-700 [&_p]:my-3 [&_ul]:my-3 [&_li]:my-1">
        {children}
      </div>
    </section>
  )
}

/**
 * Onboarding doc for first-time operators / developers using the admin area.
 */
export default function AdminGuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">ClearPath · Platform admin</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Admin guide</h1>
        <p className="text-base text-slate-600">
          This area is for <strong>you</strong> as the product owner — not for coaches. Use it to watch business health,
          help a stuck coach, check billing, and confirm integrations. You do not need to memorize everything; use this
          page as a map.
        </p>
      </header>

      <nav
        aria-label="On this page"
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Jump to</p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {nav.map(([href, label]) => (
            <li key={href}>
              <a href={href} className="text-blue-700 hover:underline">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-12">
        <Section id="quick-start" title="Quick start">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Open <Link href="/admin/overview" className="font-medium text-blue-700 hover:underline">Dashboard</Link>{' '}
              once a day — counts, revenue snapshot, and health.
            </li>
            <li>
              When a coach emails you, use{' '}
              <Link href="/admin/coaches" className="font-medium text-blue-700 hover:underline">All coaches</Link> to
              find them, then open their workspace for details, trial extension, or plan changes.
            </li>
            <li>
              If the app feels &ldquo;broken&rdquo; for everyone, check{' '}
              <Link href="/admin/system" className="font-medium text-blue-700 hover:underline">System health</Link> and{' '}
              <Link href="/admin/errors" className="font-medium text-blue-700 hover:underline">Error logs</Link> first.
            </li>
          </ol>
        </Section>

        <Section id="sidebar" title="What each sidebar item does">
          <dl className="space-y-6 not-prose">
            <div>
              <dt className="font-semibold text-slate-900">Dashboard</dt>
              <dd className="mt-1 text-slate-700">
                High-level KPIs: how many coaches and clients, revenue this month, platform health, and recent
                activity. Start here for a pulse check.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">All coaches</dt>
              <dd className="mt-1 text-slate-700">
                Searchable list of every coaching business (workspace). Filter by subscription status, see storage usage,
                and open a workspace for deeper actions (suspend, change plan, magic link sign-in for support).
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Subscriptions</dt>
              <dd className="mt-1 text-slate-700">
                MRR/ARR-style rollups by plan (Free, Starter, Pro, Scale) and a table of subscription rows synced from
                your database. Helps you reconcile who pays what tier.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">All clients</dt>
              <dd className="mt-1 text-slate-700">
                Every end-client across all coaches. Useful for support (&ldquo;find this email&rdquo;) — not for day-to-day
                coach work.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Revenue</dt>
              <dd className="mt-1 text-slate-700">
                Charts and tables: payments over time, methods (card, etc.), recent payments and subscription events.
                Complements Subscriptions with a money lens.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Stripe catalog</dt>
              <dd className="mt-1 text-slate-700">
                Shows the <strong>price IDs</strong> from your server environment and (when configured) live amounts from
                Stripe. Use it to confirm production matches what coaches see on the billing page.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Audit log</dt>
              <dd className="mt-1 text-slate-700">
                Timestamped record of important actions (logins, admin changes, payments-related events). Filter by
                date, workspace, or category. Export CSV if you need a record.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">System health</dt>
              <dd className="mt-1 text-slate-700">
                Pings database, auth, storage, Redis (rate limits), Stripe, email. Also shows rough storage totals and
                maintenance actions (test email, clear cache). Use when diagnosing outages.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Error logs</dt>
              <dd className="mt-1 text-slate-700">
                Client-side errors reported from coach and client browsers. Helps catch UI bugs you cannot see from the
                server alone.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Settings</dt>
              <dd className="mt-1 text-slate-700">
                Short notes on how admin access works and links to related tools. Not a full control panel — most
                toggles live in Vercel, Stripe, and Supabase.
              </dd>
            </div>
          </dl>
        </Section>

        <Section id="words" title="Words you will see">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Workspace</strong> — One coaching business in ClearPath (one primary coach account, their clients,
              videos, programs). Same idea as a &ldquo;tenant.&rdquo;
            </li>
            <li>
              <strong>MRR</strong> — Monthly recurring revenue: subscription money normalized per month (rough
              planning number).
            </li>
            <li>
              <strong>ARR</strong> — Annual run-rate (often MRR × 12); a forecast-style figure, not cash in hand.
            </li>
            <li>
              <strong>Plan</strong> — Product tier (Free, Starter, Pro, Scale). Usually tied to Stripe prices and client
              limits.
            </li>
            <li>
              <strong>Platform admin</strong> — This back office. Coaches never see it unless they are also your
              designated admin account.
            </li>
          </ul>
        </Section>

        <Section id="config" title="Where configuration lives">
          <p>
            The admin UI <strong>reads</strong> the live app; it does not replace your hosting dashboards. Typical split:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Vercel (or your host)</strong> — Environment variables: Supabase keys, Stripe keys and price IDs,{' '}
              <code className="rounded bg-slate-100 px-1 text-xs">ADMIN_EMAIL</code>, email, Redis, etc. Wrong env =
              wrong behavior in production.
            </li>
            <li>
              <strong>Stripe Dashboard</strong> — Products, prices, customers, subscriptions, webhooks. Your app
              listens for events at your deployed URL (e.g. <code className="rounded bg-slate-100 px-1 text-xs">/api/webhooks/stripe</code>
              ).
            </li>
            <li>
              <strong>Supabase</strong> — Database, Auth users, storage buckets, RLS. Coach/client accounts live here.
            </li>
            <li>
              <strong>This repository</strong> — <code className="rounded bg-slate-100 px-1 text-xs">.env.example</code>{' '}
              lists variable names; <code className="rounded bg-slate-100 px-1 text-xs">DEPLOYMENT.md</code> has a
              deploy checklist if your team maintains one.
            </li>
          </ul>
        </Section>

        <Section id="when-things-break" title="When something looks wrong">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <Link href="/admin/system" className="font-medium text-blue-700 hover:underline">System health</Link> —
              Which dependency failed? (DB, Stripe, Redis, …)
            </li>
            <li>
              <Link href="/admin/stripe" className="font-medium text-blue-700 hover:underline">Stripe catalog</Link> —
              Are price IDs set? Do live amounts match expectations?
            </li>
            <li>
              <Link href="/admin/errors" className="font-medium text-blue-700 hover:underline">Error logs</Link> — Any
              spike in coach/client browser errors?
            </li>
            <li>
              <Link href="/admin/audit" className="font-medium text-blue-700 hover:underline">Audit log</Link> — Did an
              admin action or failed login cluster around the time users complained?
            </li>
          </ol>
        </Section>

        <Section id="access" title="Who can open admin">
          <p>
            Access is controlled on the server: your sign-in email must match{' '}
            <code className="rounded bg-slate-100 px-1 text-xs">ADMIN_EMAIL</code> in the environment,{' '}
            <strong>or</strong> your profile must have <code className="rounded bg-slate-100 px-1 text-xs">is_super_admin</code>{' '}
            set in the database (via the <code className="rounded bg-slate-100 px-1 text-xs">setup:admin</code> script).
            There is no button inside the app to promote other users — that is intentional for safety.
          </p>
          <p>
            More detail: <Link href="/admin/settings" className="font-medium text-blue-700 hover:underline">Settings</Link>
            .
          </p>
        </Section>
      </div>

      <footer className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Tip: bookmark <AdminGuideLink /> and the{' '}
        <Link href="/admin/overview" className="font-medium text-blue-700 hover:underline">Dashboard</Link>. For code
        changes, use your normal editor and git workflow — this site only surfaces data.
      </footer>
    </div>
  )
}
