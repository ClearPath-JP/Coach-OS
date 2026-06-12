import Link from 'next/link'

const lastUpdated = 'June 11, 2026'

/**
 * Privacy Policy — public; Dojo Arcade card shell (matches terms + refunds).
 */
export default function PrivacyPage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-[var(--bg-app)] p-6 py-12">
      <div className="w-full max-w-2xl space-y-8 rounded-[18px] border-[3px] border-[var(--ink)] bg-white p-8 shadow-[6px_6px_0_var(--ink)]">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-[-0.02em] text-[var(--ink)]">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-[var(--text-tertiary)]">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-6 text-[15px] leading-relaxed text-[var(--ink)]/85">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">1. Information we collect</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li><span className="font-semibold text-[var(--ink)]">Account information</span> — name, email address, and the credentials you use to sign in.</li>
              <li><span className="font-semibold text-[var(--ink)]">Coaching data</span> — sessions, classes, messages, programs, and the client/student records you create, plus payment records you log.</li>
              <li><span className="font-semibold text-[var(--ink)]">Media you upload</span> — video and images you add to your library.</li>
              <li><span className="font-semibold text-[var(--ink)]">Usage data</span> — how you interact with the platform (pages visited, actions taken) to improve reliability and product experience.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">2. How we use your information</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>To provide and maintain the coaching platform and its features.</li>
              <li>To send session reminders, notifications, and essential service emails.</li>
              <li>To process subscription payments and the payments you collect from your students.</li>
              <li>To keep the service secure and prevent fraud or abuse.</li>
              <li>We do <span className="font-semibold">not</span> sell your personal information.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">3. Service providers we share data with</h2>
            <p>We use a small set of trusted providers to run Korva. Each receives only the data needed for its function:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><span className="font-semibold text-[var(--ink)]">Supabase</span> — database, authentication, and file storage.</li>
              <li><span className="font-semibold text-[var(--ink)]">Stripe</span> — subscription and student payments (card data is handled by Stripe, not stored by us).</li>
              <li><span className="font-semibold text-[var(--ink)]">Bunny.net</span> — video hosting and streaming.</li>
              <li><span className="font-semibold text-[var(--ink)]">Resend</span> — transactional email delivery.</li>
              <li><span className="font-semibold text-[var(--ink)]">Upstash</span> — rate limiting and abuse prevention.</li>
              <li><span className="font-semibold text-[var(--ink)]">Anthropic</span> — AI-assisted features (e.g. drafting captions and content), when you use them.</li>
              <li><span className="font-semibold text-[var(--ink)]">Vercel</span> — application hosting and delivery.</li>
            </ul>
            <p>We do not share your data with advertisers.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">4. Cookies</h2>
            <p>
              We use essential cookies to keep you signed in and to keep the service secure. We do not use third-party
              advertising cookies. You can clear cookies in your browser, but doing so will sign you out.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">5. Data storage and security</h2>
            <p>
              Traffic is encrypted in transit (HTTPS/TLS), and data at rest is encrypted by our infrastructure providers
              according to industry standards. Access is restricted to authenticated users and role-based permissions
              within the product.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">6. Your rights</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Access and review much of your data directly in the app.</li>
              <li><span className="font-semibold text-[var(--ink)]">Deletion</span> — coaches can remove a client and associated data from their workspace where the product supports it. You may request deletion of your account or data by emailing us; we may retain minimal records where the law requires (for example tax or fraud prevention).</li>
              <li>Request an export of your data by contacting us.</li>
              <li><span className="font-semibold text-[var(--ink)]">US residents (e.g. California):</span> you have the right to know what we collect, to request deletion, and to opt out of any &quot;sale&quot; of personal information — and we do not sell it.</li>
              <li><span className="font-semibold text-[var(--ink)]">EU/UK residents:</span> you may exercise your rights of access, correction, deletion, and portability by contacting us.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">7. Students &amp; minors</h2>
            <p>
              Korva is intended for coaches and their adult clients. If you add students who are minors, you are
              responsible for obtaining any consents required by law before entering their information. Korva is not
              directed to children, and we do not knowingly collect data directly from children.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">8. Data retention</h2>
            <p>
              We keep your information only as long as needed to run the service, meet legal obligations, resolve
              disputes, and enforce our agreements. Backup copies may persist for a short period after deletion, and
              subscription and payment records may be retained longer as required for accounting and tax rules.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-[var(--ink)]">9. Contact</h2>
            <p>
              Questions about this policy, data export, or deletion requests:{' '}
              <a href="mailto:hello@foundos.ai" className="font-semibold underline">hello@foundos.ai</a>.
            </p>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t-[3px] border-[var(--ink)]/10 pt-6 text-center text-sm text-[var(--text-tertiary)]">
          <Link href="/terms" className="font-semibold text-[var(--ink)] hover:underline">Terms</Link>
          <Link href="/refunds" className="font-semibold text-[var(--ink)] hover:underline">Refunds</Link>
          <Link href="/login" className="font-semibold text-[var(--ink)] hover:underline">Back to sign in</Link>
        </div>
      </div>
    </main>
  )
}
