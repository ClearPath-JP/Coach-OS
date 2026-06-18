import Link from 'next/link'

/**
 * FaqSection — landing FAQ + payment/security reassurance.
 *
 * Sits between the dark Pricing section and the light final CTA, so it uses a
 * LIGHT background (var(--bg-app)) to transition cleanly out of var(--ink).
 *
 * Accordion uses native <details>/<summary> on purpose: every answer is in the
 * SSR markup and readable with JavaScript disabled. We do NOT gate FAQ
 * visibility on hydration (the site previously had framer-motion hide content
 * until JS loaded — never again for copy people need to read).
 *
 * All copy is checked against the codebase/docs:
 *  - No application_fee anywhere in the Stripe checkout routes (buy-pass,
 *    book-class, membership-checkout all use transfer_data.destination only) →
 *    Korva takes no middleman cut; Stripe's own processing fee still applies.
 *  - No coach-facing one-click data export exists (only an admin support tool),
 *    so data-out is phrased as a stance ("email us and we'll help"), not a feature.
 */

type Faq = {
  q: string
  /** Answer rendered as JSX so we can drop in links. */
  a: React.ReactNode
  /** Belt accent for the marker, cycled per item. */
  belt: string
}

const faqs: Faq[] = [
  {
    q: 'Do my students have to download an app?',
    belt: 'var(--belt-yellow)',
    a: (
      <>
        No. Your students just open a link in their phone&apos;s browser and log in —
        no App Store, no install, nothing to set up. If they want, they can add it to
        their home screen so it feels like an app, but that&apos;s optional. The whole
        point is that signing up a student takes a text message, not a tutorial.
      </>
    ),
  },
  {
    q: 'How do payments work — does Korva take a cut of what I earn?',
    belt: 'var(--belt-teal)',
    a: (
      <>
        You charge your own students directly — classes, passes, memberships, programs —
        and the money goes from your student to you through Stripe. Korva takes{' '}
        <strong>no middleman cut of what you earn</strong>; you keep what you charge.
        The only fee on those payments is Stripe&apos;s own standard processing fee,
        because Stripe is the company actually moving the card payment — that part
        isn&apos;t us. Korva&apos;s own bill is just your flat monthly subscription, separate
        from your student revenue.
      </>
    ),
  },
  {
    q: 'How is my dojo secured, and where do card numbers live?',
    belt: 'var(--belt-coral)',
    a: (
      <>
        All payments run on Stripe, so card numbers go straight to Stripe — Korva never
        sees or stores them. Each coach&apos;s dojo is walled off: your students, notes,
        videos, and payments are private to your workspace, not shared with other
        coaches. You can read the details in our{' '}
        <Link href="/privacy" className="underline decoration-2 underline-offset-2 hover:opacity-70">
          privacy policy
        </Link>
        .
      </>
    ),
  },
  {
    q: 'Is there a contract, and how do I cancel?',
    belt: 'var(--belt-blue)',
    a: (
      <>
        No contract. Korva is month-to-month — billed monthly in advance, auto-renewing,
        cancel anytime. To cancel, go to <strong>Settings → Billing</strong> in the app,
        or email{' '}
        <a href="mailto:hello@foundos.ai" className="underline decoration-2 underline-offset-2 hover:opacity-70">
          hello@foundos.ai
        </a>
        . It takes effect at the end of your current billing period — you keep full access
        until then, and there&apos;s no further charge. Full terms live on the{' '}
        <Link href="/terms" className="underline decoration-2 underline-offset-2 hover:opacity-70">
          terms page
        </Link>
        .
      </>
    ),
  },
  {
    q: 'What happens to my students, videos, and content if I cancel?',
    belt: 'var(--belt-violet)',
    a: (
      <>
        They&apos;re yours. Your students, videos, and content belong to you — cancelling
        just stops billing at the end of the period. If you need your data out, email us
        and we&apos;ll help you get it. We don&apos;t hold your dojo hostage.
      </>
    ),
  },
  {
    q: 'Can I get a refund?',
    belt: 'var(--belt-yellow)',
    a: (
      <>
        Because it&apos;s month-to-month, cancelling stops your next charge, and we
        generally don&apos;t prorate refunds for a period you&apos;re already in. That
        said — if you were charged in error, charged after you cancelled, or something
        broke on our end, we&apos;ll make it right. Email us within 14 days and we&apos;ll
        sort out a refund or credit. See the{' '}
        <Link href="/refunds" className="underline decoration-2 underline-offset-2 hover:opacity-70">
          refund policy
        </Link>{' '}
        for the specifics.
      </>
    ),
  },
  {
    q: 'How does the 14-day free trial work?',
    belt: 'var(--belt-teal)',
    a: (
      <>
        You start with <strong>14 days free</strong> — $0 due today. We save a card so
        the trial rolls straight into your plan, but you&apos;re not charged until day 15.
        If Korva isn&apos;t for you, cancel any time during the trial and you pay nothing.
        After the trial it&apos;s <strong>$99/mo</strong>, cancel whenever.
      </>
    ),
  },
  {
    q: 'Is this actually built, or is it still early?',
    belt: 'var(--belt-coral)',
    a: (
      <>
        It&apos;s built and working right now — client tracking, session notes, scheduling,
        group classes, memberships, and Stripe billing are all live, not coming-soon
        promises. It&apos;s early in the sense that I&apos;m hand-onboarding the first{' '}
        <strong>10 founding coaches</strong>, who lock <strong>$99/mo for life</strong>{' '}
        with full Pro access and a direct line to me. After those fill, the public tiers
        ($79 / $149 / $299) take over.
      </>
    ),
  },
]

export function FaqSection() {
  return (
    <section
      id="faq"
      className="relative border-b-[3px] border-[var(--ink)] bg-[var(--bg-app)] py-20 md:py-28"
    >
      <div className="relative mx-auto max-w-3xl px-6">
        {/* Section header — eyebrow + headline, matching the arcade pattern */}
        <div className="text-center mb-12 md:mb-14">
          <span className="arcade-badge arcade-badge-blue">❓ Straight answers</span>
          <h2 className="mt-5 font-[family-name:var(--font-display)] text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-[-0.04em] leading-[1.05] text-[var(--ink)]">
            Questions, answered
            <br />
            like a coach.
          </h2>
          <p className="mt-3 text-base font-medium text-[var(--text-secondary)]">
            No fine print, no runaround. The stuff coaches actually ask before they sign up.
          </p>
        </div>

        {/* Native accordion — all answers are in the SSR markup, no JS required */}
        <div className="space-y-4">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-[16px] border-[3px] border-[var(--ink)] bg-white shadow-[5px_5px_0_var(--ink)] transition-shadow open:shadow-[7px_7px_0_var(--ink)] [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center gap-4 px-6 py-5 font-[family-name:var(--font-display)] text-base sm:text-lg font-extrabold text-[var(--ink)]">
                {/* Belt-colored square marker that flips to a minus when open */}
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border-[3px] border-[var(--ink)] text-lg font-extrabold leading-none text-[var(--ink)]"
                  style={{ backgroundColor: faq.belt }}
                >
                  <span className="block group-open:hidden">+</span>
                  <span className="hidden group-open:block">–</span>
                </span>
                <span className="flex-1">{faq.q}</span>
              </summary>
              <div className="border-t-[3px] border-[var(--ink)]/10 px-6 py-5 pl-[72px] text-[15px] font-medium leading-relaxed text-[var(--text-secondary)]">
                {faq.a}
              </div>
            </details>
          ))}
        </div>

        {/* Soft close — still a question, points at a person, not a funnel */}
        <p className="mt-10 text-center text-sm font-medium text-[var(--text-tertiary)]">
          Still have a question? Email{' '}
          <a
            href="mailto:hello@foundos.ai"
            className="font-bold text-[var(--ink)] underline decoration-2 underline-offset-2 hover:opacity-70"
          >
            hello@foundos.ai
          </a>{' '}
          — a real coach reads it.
        </p>
      </div>
    </section>
  )
}
