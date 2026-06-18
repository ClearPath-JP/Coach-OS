'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

/**
 * Trust / social-proof section.
 *
 * HONESTY RULE: Korva has no live coaches yet, so this section contains NO
 * fabricated testimonials, names, photos, logos, or numbers. Every tile below
 * is a verifiable, true statement. The `testimonials` array is intentionally
 * EMPTY and only renders when real founding-coach quotes exist (see below).
 */

// Each tile is a TRUE, verifiable trust signal — no invented claims.
const signals: { belt: string; icon: string; title: string; body: string }[] = [
  {
    belt: 'var(--belt-coral)',
    icon: '🥋',
    title: 'Built by a coach',
    body: 'Made by someone who ran a dojo — not a software company guessing what coaches need.',
  },
  {
    belt: 'var(--belt-teal)',
    icon: '💸',
    title: 'No middleman cut',
    body: 'You keep what you earn from your students. Payments run on Stripe — only its standard processing fee applies.',
  },
  {
    belt: 'var(--belt-blue)',
    icon: '🔒',
    title: 'Secured by Stripe',
    body: 'Billing is handled by Stripe. Korva never sees or stores a single card number.',
  },
  {
    belt: 'var(--belt-violet)',
    icon: '📆',
    title: 'No contracts',
    body: 'Month-to-month. Cancel anytime, in a click — no calls, no lock-in, no penalty.',
  },
  {
    belt: 'var(--belt-yellow)',
    icon: '🗝️',
    title: 'Your dojo is yours',
    body: 'Your students and your content belong to you. We never hold your dojo hostage.',
  },
  {
    belt: 'var(--belt-teal)',
    icon: '⚡',
    title: 'Live, not vaporware',
    body: 'Tracking, scheduling, classes, memberships and Stripe billing all work today.',
  },
]

/**
 * Real founding-coach quotes get dropped in here — and ONLY here — once the
 * first coaches go live. Keep this empty until then: never fabricate quotes,
 * names, or details. Example shape (do NOT ship until it's a real coach who
 * gave permission):
 *   { quote: 'Korva replaced four apps for my dojo.', name: 'A. Real Coach', detail: 'BJJ · Atlanta' }
 * When non-empty, the quote block below renders automatically.
 */
const testimonials: { quote: string; name: string; detail?: string }[] = []

export function TrustSection() {
  return (
    <section
      id="trust"
      className="relative border-b-[3px] border-[var(--ink)] bg-[var(--bg-subtle)] py-20 md:py-28"
    >
      <div className="relative mx-auto max-w-6xl px-6">
        {/* Header — frames the early stage as an advantage */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-2xl mx-auto"
        >
          <span className="arcade-badge arcade-badge-yellow">🏆 Founding coaches</span>

          <h2 className="mt-5 font-[family-name:var(--font-display)] text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-[-0.04em] leading-[1.05] text-[var(--ink)]">
            Be one of the
            <br />
            first <span style={{ color: 'var(--belt-coral)' }}>10 coaches</span> in.
          </h2>

          <p className="mt-5 text-base md:text-lg font-medium text-[var(--text-secondary)] leading-relaxed">
            Getting in early isn&apos;t a risk — it&apos;s the advantage. You help shape the product,
            lock in a rate that never goes up, and get a direct line to the founder while the dojo is
            still small.
          </p>
        </motion.div>

        {/* True trust-signal tiles */}
        <div className="mt-12 md:mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {signals.map((signal, i) => (
            <motion.div
              key={signal.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="arcade-lift flex flex-col rounded-[18px] border-[3px] border-[var(--ink)] bg-white p-6 shadow-[5px_5px_0_var(--ink)]"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-[12px] border-[3px] border-[var(--ink)] text-lg shadow-[3px_3px_0_var(--ink)]"
                style={{ background: signal.belt }}
                aria-hidden="true"
              >
                {signal.icon}
              </span>
              <h3 className="mt-4 font-[family-name:var(--font-display)] text-lg font-extrabold tracking-[-0.02em] text-[var(--ink)]">
                {signal.title}
              </h3>
              <p className="mt-2 text-sm font-medium text-[var(--text-secondary)] leading-relaxed">
                {signal.body}
              </p>
            </motion.div>
          ))}
        </div>

        {/*
          Testimonial slot — renders ONLY when a real coach quote exists.
          Empty today (honesty rule), so nothing shows.
        */}
        {testimonials.length > 0 && (
          <div className="mt-12 md:mt-14 grid md:grid-cols-2 gap-5">
            {testimonials.map((t) => (
              <figure
                key={t.name}
                className="flex flex-col rounded-[18px] border-[3px] border-[var(--ink)] bg-[var(--belt-yellow)] p-6 shadow-[5px_5px_0_#b8910f]"
              >
                <blockquote className="font-[family-name:var(--font-display)] text-lg font-bold leading-snug text-[var(--ink)]">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-4 font-[family-name:var(--font-display)] text-sm font-extrabold text-[var(--ink)]">
                  {t.name}
                  {t.detail && (
                    <span className="block text-xs font-semibold text-[var(--ink)]/70">
                      {t.detail}
                    </span>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        {/* CTA — matches the site-wide standardized copy exactly */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 md:mt-14 text-center"
        >
          <Link
            href="/signup?role=coach"
            className="group inline-flex items-center gap-2 font-[family-name:var(--font-display)] font-bold text-base text-[var(--ink)] bg-[var(--belt-yellow)] border-[3px] border-[var(--ink)] rounded-[14px] px-8 py-4 shadow-[5px_5px_0_#b8910f] hover:-translate-x-px hover:-translate-y-px hover:shadow-[7px_7px_0_#b8910f] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all"
          >
            Start your free 14-day trial
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <p className="mt-4 font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--text-tertiary)]">
            14 days free · $0 due today · then $99/mo · cancel anytime
          </p>
        </motion.div>
      </div>
    </section>
  )
}
