'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

const plans = [
  {
    name: 'Starter',
    price: 79,
    description: 'For coaches just getting started online.',
    features: [
      'Up to 15 students',
      '5 GB video storage',
      '25 GB monthly streaming',
      'Programs & assignments',
      'Dojo chat',
      'Student progress tracking',
    ],
  },
  {
    name: 'Pro',
    price: 149,
    description: 'For coaches ready to grow their dojo.',
    popular: true,
    features: [
      'Unlimited students',
      '25 GB video storage',
      '100 GB monthly streaming',
      '50 lead searches / month',
      'Custom dojo branding',
      'Advanced analytics',
    ],
  },
  {
    name: 'Scale',
    price: 299,
    description: 'For coaches building a training empire.',
    features: [
      'Unlimited students',
      '100 GB video storage',
      '500 GB monthly streaming',
      '200 lead searches / month',
      'White-label branding',
      'Priority support',
    ],
  },
]

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="relative border-b-[3px] border-[var(--ink)] bg-[var(--ink)] py-20 md:py-28"
    >
      <div className="relative mx-auto max-w-6xl px-6">
        {/* Section header */}
        <div className="text-center mb-12 md:mb-14">
          <span className="font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-[0.14em] text-[#faf7f0]/45">
            Founder pricing
          </span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-[-0.04em] leading-[1.05] text-[#faf7f0]">
            Lock in <span style={{ color: 'var(--belt-yellow)' }}>$99/mo</span>
            <br />
            for life.
          </h2>
          <p className="mt-3 text-base font-medium text-[#faf7f0]/60">
            The first 10 founding coaches keep this rate forever — full Pro access, $50/mo off, never goes up.
          </p>
        </div>

        {/* Pricing cards — founding (featured) + 3 tiers */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 items-end">
          {/* FOUNDING — featured belt-yellow card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--belt-yellow)] p-7 shadow-[7px_7px_0_#b8910f] lg:-translate-y-2"
          >
            <span className="arcade-badge arcade-badge-dark self-start mb-4">
              🏆 Founding · 10 spots
            </span>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-extrabold text-[var(--ink)]">
              Founding Coach
            </h3>
            <div className="mt-1 mb-5">
              <span className="font-[family-name:var(--font-display)] text-5xl font-extrabold tracking-[-0.04em] text-[var(--ink)]">
                $99
              </span>
              <span className="font-[family-name:var(--font-display)] text-sm font-bold text-[var(--ink)]">
                /mo for life
              </span>
            </div>
            <Link
              href="/signup?role=coach&plan=founding"
              className="block text-center font-[family-name:var(--font-display)] font-bold text-sm text-[var(--ink)] bg-[var(--belt-blue)] border-[3px] border-[var(--ink)] rounded-[12px] px-5 py-3 shadow-[4px_4px_0_var(--ink)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_var(--ink)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              Claim a spot →
            </Link>
            <ul className="mt-5 space-y-2 font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--ink)]">
              <li>✓ Everything in Pro</li>
              <li>✓ Locked rate forever</li>
              <li>✓ Founding badge</li>
              <li>✓ Direct line to founder</li>
            </ul>
            {/* Spots cap indicator (illustrative — the offer is capped at 10) */}
            <div className="mt-5 pt-4 border-t-[3px] border-[var(--ink)]/15">
              <div className="flex justify-between font-[family-name:var(--font-display)] text-xs font-bold text-[var(--ink)] mb-1.5">
                <span>Founding spots</span>
                <span>First 10 coaches</span>
              </div>
              <div className="arcade-track">
                <div className="arcade-fill arcade-fill-coral" style={{ width: '70%' }} />
              </div>
            </div>
          </motion.div>

          {/* TIER CARDS — white brutal cards */}
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: (i + 1) * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="arcade-lift flex flex-col rounded-[20px] border-[3px] border-[var(--ink)] bg-white p-7 shadow-[5px_5px_0_var(--ink)]"
            >
              <div className="flex items-center gap-2">
                <h3 className="font-[family-name:var(--font-display)] text-lg font-extrabold text-[var(--ink)]">
                  {plan.name}
                </h3>
                {plan.popular && (
                  <span className="arcade-badge arcade-badge-teal !text-[10px]">Popular</span>
                )}
              </div>
              <p className="text-xs font-medium text-[var(--text-tertiary)] mt-1">
                {plan.description}
              </p>

              <div className="mt-4 mb-5">
                <span className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-[-0.04em] text-[var(--ink)]">
                  ${plan.price}
                </span>
                <span className="font-[family-name:var(--font-display)] text-sm font-bold text-[var(--text-tertiary)]">
                  /mo
                </span>
              </div>

              <Link
                href={`/signup?role=coach&plan=${plan.name.toLowerCase()}`}
                className={`block text-center font-[family-name:var(--font-display)] font-bold text-sm border-[3px] border-[var(--ink)] rounded-[12px] px-5 py-3 transition-all ${
                  plan.popular
                    ? 'text-[var(--ink)] bg-[var(--belt-yellow)] shadow-[4px_4px_0_#b8910f] hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_#b8910f] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
                    : 'text-[var(--ink)] bg-white hover:bg-[var(--bg-muted)] active:translate-x-0.5 active:translate-y-0.5'
                }`}
              >
                Get started
              </Link>

              <ul className="mt-6 space-y-2.5 font-[family-name:var(--font-display)] text-sm font-medium text-[var(--text-secondary)]">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="text-[var(--belt-teal)] font-bold shrink-0">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
