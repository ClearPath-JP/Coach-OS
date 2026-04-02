import Link from 'next/link'
import { AdminGuideLink } from '@/components/admin/AdminGuideLink'

export default function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings &amp; access</h1>
        <p className="mt-2 text-sm text-slate-600">
          This page explains how admin works. Day-to-day product settings for coaches live inside each workspace (coach
          dashboard), not here.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Who can use admin</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>
            Your sign-in email matches the server variable{' '}
            <code className="rounded bg-slate-100 px-1 text-xs">ADMIN_EMAIL</code> (set in Vercel /{' '}
            <code className="rounded bg-slate-100 px-1 text-xs">.env.local</code> for local dev),{' '}
            <strong>or</strong>
          </li>
          <li>
            Your Supabase profile has <code className="rounded bg-slate-100 px-1 text-xs">is_super_admin = true</code>{' '}
            (usually set by running <code className="rounded bg-slate-100 px-1 text-xs">pnpm run setup:admin</code>{' '}
            once after you create the account).
          </li>
        </ul>
        <p className="mt-3 text-sm text-slate-600">
          There is no in-app button to grant admin to other people — that keeps the surface area small. To add another
          operator, create their Auth user, then set the flag with the script or match their email in{' '}
          <code className="rounded bg-slate-100 px-1 text-xs">ADMIN_EMAIL</code>.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Helpful links</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>
            <AdminGuideLink /> — plain-language map of Dashboard, coaches, Stripe, audit, health, and more.
          </li>
          <li>
            <Link href="/admin/stripe" className="font-medium text-blue-700 hover:underline">
              Stripe catalog
            </Link>{' '}
            — price IDs and live amounts from Stripe.
          </li>
          <li>
            <Link href="/admin/system" className="font-medium text-blue-700 hover:underline">
              System health
            </Link>{' '}
            — test email, cache, integration flags.
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-sm font-semibold text-slate-900">For developers</h2>
        <p className="mt-2 text-sm text-slate-700">
          Environment variable names live in <code className="rounded bg-slate-200 px-1 text-xs">.env.example</code> in
          the repo. Deploy checklists and Stripe webhook notes are in{' '}
          <code className="rounded bg-slate-200 px-1 text-xs">DEPLOYMENT.md</code> if your project keeps it up to date.
        </p>
      </section>
    </div>
  )
}
