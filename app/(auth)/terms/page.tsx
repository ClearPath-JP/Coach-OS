import Link from 'next/link'

const lastUpdated = 'June 11, 2026'

/**
 * Terms of Service — public; Dojo Arcade card shell (matches privacy + refunds).
 */
export default function TermsPage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-[var(--bg-app)] p-6 py-12">
      <div className="w-full max-w-2xl space-y-8 rounded-[18px] border-[3px] border-[var(--ink)] bg-white p-8 shadow-[6px_6px_0_var(--ink)]">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-[-0.02em] text-[var(--ink)]">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-[var(--text-tertiary)]">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-6 text-[15px] leading-relaxed text-[var(--ink)]/85">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">1. Acceptance of terms</h2>
            <p>
              By creating an account or using Korva (a product of FoundOS), you agree to these Terms of Service and our{' '}
              <Link href="/privacy" className="font-semibold underline">Privacy Policy</Link> and{' '}
              <Link href="/refunds" className="font-semibold underline">Refund &amp; Cancellation Policy</Link>. If you
              do not agree, do not use the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">2. Description of service</h2>
            <p>
              Korva is a coaching management platform. We provide software tools (scheduling, classes, messaging,
              programs, video, and billing helpers). Coaches are independent professionals: you provide the coaching;
              we provide the platform. We are not a party to the coaching relationship between you and your clients.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">3. Coach responsibilities</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>You are responsible for your relationships with clients, including scope of services and professional standards.</li>
              <li>You are responsible for complying with the laws that apply to your business, including any professional licensing, tax, and consumer-disclosure obligations.</li>
              <li>You must keep your account credentials secure and are responsible for activity under your account.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">4. Payments you collect from your students (Stripe Connect)</h2>
            <p>
              Korva lets you charge your own students through Stripe Connect. Those payments are between{' '}
              <span className="font-semibold">you and your student</span>. You are the merchant of record for them; you
              set your own pricing, refund, and cancellation terms, and you are responsible for refunds, disputes,
              chargebacks, taxes, and any consumer disclosures required for those payments. FoundOS is not a party to
              those transactions and does not mediate every dispute between you and your students. Your use of Stripe is
              also subject to Stripe&apos;s own terms.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">5. Your subscription &amp; billing</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li><span className="font-semibold">14-day free trial:</span> new coach accounts start with a 14-day free trial. We save your payment method at signup but do not charge it during the trial. If you do not cancel before the trial ends, your paid subscription begins automatically at the price shown at checkout. Cancel anytime during the trial to avoid any charge.</li>
              <li>Korva coach subscriptions are billed monthly in advance at the price shown at checkout.</li>
              <li><span className="font-semibold">Auto-renewal:</span> your subscription renews automatically each month until you cancel. You authorize us (through our payment processor, Stripe) to charge your payment method for each renewal.</li>
              <li>A &quot;founding&quot; rate, where offered, stays fixed for as long as your subscription remains active and continuous; if it lapses, the founding rate may no longer be available.</li>
              <li>We may change standard plan prices with at least 30 days&apos; notice; changes do not affect a billing period already paid.</li>
              <li>If a payment fails, we may retry and may suspend access until it is resolved.</li>
              <li>Cancellations and refunds are governed by our <Link href="/refunds" className="font-semibold underline">Refund &amp; Cancellation Policy</Link>.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">6. Acceptable use</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>No illegal activity, fraud, or misuse of the platform.</li>
              <li>No spam, harassment, or content that violates applicable law or others&apos; rights.</li>
              <li>No attempts to breach security, scrape at scale, or disrupt the service.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">7. Limitation of liability</h2>
            <p>
              The service is provided &quot;as is.&quot; To the fullest extent permitted by law, Korva and its operator
              FoundOS are not liable for indirect, incidental, or consequential damages arising from your use of the
              service. Our total liability for claims relating to the service is limited to the amount you paid us in the
              twelve months before the claim, where applicable.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">8. Governing law</h2>
            <p>
              Korva is operated by FoundOS in the United States. These Terms are governed by the laws of the United
              States and the state in which FoundOS is established, without regard to conflict-of-laws rules. Any
              dispute will be resolved in the courts located there, unless applicable law requires otherwise.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">9. Changes to these terms</h2>
            <p>
              We may update these Terms from time to time. If we make material changes, we will update the date above
              and, where appropriate, notify you in the app or by email. Continued use after changes take effect means
              you accept the updated Terms.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">10. Contact</h2>
            <p>
              Questions about these terms:{' '}
              <a href="mailto:hello@foundos.ai" className="font-semibold underline">hello@foundos.ai</a>.
            </p>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t-[3px] border-[var(--ink)]/10 pt-6 text-center text-sm text-[var(--text-tertiary)]">
          <Link href="/privacy" className="font-semibold text-[var(--ink)] hover:underline">Privacy</Link>
          <Link href="/refunds" className="font-semibold text-[var(--ink)] hover:underline">Refunds</Link>
          <Link href="/login" className="font-semibold text-[var(--ink)] hover:underline">Back to sign in</Link>
        </div>
      </div>
    </main>
  )
}
