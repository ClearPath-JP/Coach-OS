import Link from 'next/link'

const lastUpdated = 'March 25, 2026'

/**
 * Privacy policy — public; no sidebar (same shell as forgot-password).
 */
export default function PrivacyPage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-[var(--color-surface)] p-6 py-12">
      <div className="w-full max-w-lg space-y-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Privacy Policy</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-6 text-[15px] leading-[var(--leading-body)] text-[var(--color-text-primary)]">
          <section className="space-y-2">
            <h2 className="text-base font-medium text-[var(--color-text-primary)]">1. Information we collect</h2>
            <ul className="list-disc space-y-1 pl-5 text-[var(--color-text-secondary)]">
              <li>
                <span className="text-[var(--color-text-primary)]">Account information</span> — name, email address,
                and credentials you use to sign in.
              </li>
              <li>
                <span className="text-[var(--color-text-primary)]">Coaching data</span> — sessions, messages, programs
                you create or assign, payment records you log, and related metadata needed to run your practice.
              </li>
              <li>
                <span className="text-[var(--color-text-primary)]">Usage data</span> — how you interact with the
                platform (e.g. pages visited, actions taken) to improve reliability and product experience.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium text-[var(--color-text-primary)]">2. How we use your information</h2>
            <ul className="list-disc space-y-1 pl-5 text-[var(--color-text-secondary)]">
              <li>To provide and maintain the coaching platform and its features.</li>
              <li>To send session reminders, notifications, and essential service emails.</li>
              <li>To process subscription payments through Stripe (payment data is handled by Stripe under their policies).</li>
              <li>We do not sell your personal information.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium text-[var(--color-text-primary)]">3. Data storage and security</h2>
            <p className="text-[var(--color-text-secondary)]">
              Data is stored using Supabase (managed PostgreSQL and related services). Traffic is encrypted in transit
              (HTTPS/TLS). Data at rest is encrypted by our infrastructure providers according to industry standards.
              Access is restricted to authenticated users and role-based permissions within the product.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium text-[var(--color-text-primary)]">4. Your rights</h2>
            <ul className="list-disc space-y-1 pl-5 text-[var(--color-text-secondary)]">
              <li>Access and review much of your data directly in the app.</li>
              <li>Delete your account via Settings (subject to retention needed for legal or billing obligations).</li>
              <li>Request an export of your data — contact us at the email below.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium text-[var(--color-text-primary)]">5. Contact</h2>
            <p className="text-[var(--color-text-secondary)]">
              Questions about this policy:{' '}
              <a href="mailto:privacy@clearpath.com" className="text-[var(--color-accent)] underline">
                privacy@clearpath.com
              </a>
            </p>
          </section>
        </div>

        <p className="border-t border-[var(--color-border)] pt-6 text-center text-sm text-[var(--color-text-secondary)]">
          <Link href="/login" className="text-[var(--color-accent)] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
