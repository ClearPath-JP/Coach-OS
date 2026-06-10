import Link from 'next/link'

const lastUpdated = 'March 25, 2026'

/**
 * Terms of Service — public; no sidebar (same shell as forgot-password).
 */
export default function TermsPage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-[var(--color-surface)] p-6 py-12">
      <div className="w-full max-w-lg space-y-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">Terms of Service</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-6 text-[15px] leading-[var(--leading-body)] text-[var(--color-text-primary)]">
          <section className="space-y-2">
            <h2 className="text-base font-medium text-[var(--color-text-primary)]">1. Acceptance of terms</h2>
            <p className="text-[var(--color-text-secondary)]">
              By creating an account or using Korva (a product of FoundOS), you agree to these Terms of Service and our
              Privacy Policy. If you do not agree, do not use the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium text-[var(--color-text-primary)]">2. Description of service</h2>
            <p className="text-[var(--color-text-secondary)]">
              Korva is a coaching management platform. We provide software tools (scheduling, messaging, programs,
              billing helpers, and related features). Coaches are independent professionals: you provide the coaching;
              we provide the platform. We are not a party to the coaching relationship between you and your clients.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium text-[var(--color-text-primary)]">3. Coach responsibilities</h2>
            <ul className="list-disc space-y-1 pl-5 text-[var(--color-text-secondary)]">
              <li>You are responsible for your relationships with clients, including scope of services and professional standards.</li>
              <li>Payment disputes between coach and client are between those parties; Korva facilitates tools but does not mediate every dispute.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium text-[var(--color-text-primary)]">4. Acceptable use</h2>
            <ul className="list-disc space-y-1 pl-5 text-[var(--color-text-secondary)]">
              <li>No illegal activity, fraud, or misuse of the platform.</li>
              <li>No spam, harassment, or content that violates applicable law or others&apos; rights.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium text-[var(--color-text-primary)]">5. Payment terms</h2>
            <ul className="list-disc space-y-1 pl-5 text-[var(--color-text-secondary)]">
              <li>Subscriptions are billed on a recurring basis (e.g. monthly) as shown at checkout.</li>
              <li>Cancellation generally takes effect at the end of the current billing period unless stated otherwise.</li>
              <li>No refunds for partial billing periods unless required by law or explicitly offered in writing.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium text-[var(--color-text-primary)]">6. Limitation of liability</h2>
            <p className="text-[var(--color-text-secondary)]">
              To the fullest extent permitted by law, Korva and its operator FoundOS are not liable for indirect,
              incidental, or consequential damages arising from your use of the service. Our total liability for claims
              relating to the service is limited to the amount you paid us in the twelve months before the claim, where
              applicable.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-medium text-[var(--color-text-primary)]">7. Contact</h2>
            <p className="text-[var(--color-text-secondary)]">
              For questions about these terms:{' '}
              <a href="mailto:hello@foundos.ai" className="text-[var(--color-accent)] underline">
                hello@foundos.ai
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
