import Link from 'next/link'

const lastUpdated = 'June 11, 2026'

/**
 * Refund & Cancellation Policy — public; Dojo Arcade card shell (matches
 * terms + privacy). Linked from the footer and the /subscribe checkout page.
 */
export default function RefundsPage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-[var(--bg-app)] p-6 py-12">
      <div className="w-full max-w-2xl space-y-8 rounded-[18px] border-[3px] border-[var(--ink)] bg-white p-8 shadow-[6px_6px_0_var(--ink)]">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-[-0.02em] text-[var(--ink)]">
            Refund &amp; Cancellation Policy
          </h1>
          <p className="mt-2 text-sm text-[var(--text-tertiary)]">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-6 text-[15px] leading-relaxed text-[var(--ink)]/85">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">1. Your Korva subscription</h2>
            <p>
              Korva coach plans are billed monthly in advance and renew automatically each month until you cancel.
              The price shown at checkout is the price you pay; founding plans keep their rate for as long as the
              subscription stays active and continuous.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">2. How to cancel</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Cancel anytime from <span className="font-semibold">Settings → Billing</span> inside the app, or email us at <a href="mailto:hello@foundos.ai" className="font-semibold underline">hello@foundos.ai</a>.</li>
              <li>Cancellation takes effect at the end of your current billing period. You keep full access until then, and you will not be charged again.</li>
              <li>We do not lock you into annual contracts — coach plans are month-to-month.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">3. Refunds</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Because plans are month-to-month, cancelling stops the next charge — so most situations are resolved by cancelling before your renewal date rather than by a refund.</li>
              <li>We generally do not provide prorated refunds for the unused portion of a billing period already paid.</li>
              <li><span className="font-semibold">We&apos;ll make it right:</span> if you were charged in error, charged after cancelling, or a technical problem on our side prevented you from using Korva, email us within 14 days of the charge and we will refund or credit you.</li>
              <li>Where applicable consumer-protection law requires a refund, we comply with that law.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">4. Payments you collect from your students</h2>
            <p>
              Korva lets you charge your own students (for classes, passes, memberships, and programs) through Stripe
              Connect. Those payments flow between <span className="font-semibold">you and your student</span>. You set
              your own refund and cancellation terms for your students, and you are responsible for handling their
              refunds, disputes, and chargebacks. FoundOS provides the software but is not the merchant of record for
              those payments and does not issue refunds to your students on your behalf.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">5. Disputes &amp; chargebacks</h2>
            <p>
              If something looks wrong on your bill, please contact us first at{' '}
              <a href="mailto:hello@foundos.ai" className="font-semibold underline">hello@foundos.ai</a> — we&apos;re a
              small team and we resolve billing issues quickly, usually faster than a card dispute.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">6. Contact</h2>
            <p>
              Questions about cancelling or a refund:{' '}
              <a href="mailto:hello@foundos.ai" className="font-semibold underline">hello@foundos.ai</a>.
            </p>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t-[3px] border-[var(--ink)]/10 pt-6 text-center text-sm text-[var(--text-tertiary)]">
          <Link href="/terms" className="font-semibold text-[var(--ink)] hover:underline">Terms</Link>
          <Link href="/privacy" className="font-semibold text-[var(--ink)] hover:underline">Privacy</Link>
          <Link href="/login" className="font-semibold text-[var(--ink)] hover:underline">Back to sign in</Link>
        </div>
      </div>
    </main>
  )
}
