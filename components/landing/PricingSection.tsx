'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Check } from 'lucide-react'

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
      'Access codes',
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
      'Multiple dojos',
      'API access',
      'Priority support',
    ],
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="relative py-24 md:py-32">
      {/* Accent glow */}
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-[var(--accent)] opacity-[0.03] blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="text-xs font-semibold tracking-widest uppercase text-[var(--accent)]">
            Pricing
          </span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold text-[var(--text-primary)]">
            Pricing that grows with you
          </h2>
          <p className="mt-4 text-[var(--text-secondary)] max-w-lg mx-auto">
            Students join free. Coaches pick a plan that fits their dojo.
          </p>
        </div>

        {/* Founding early-bird offer — current launch deal; the 3-tier ladder below is the public "later" pricing */}
        <div className="relative mx-auto mb-12 max-w-3xl overflow-hidden rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/[0.06] p-6 text-center">
          <span className="text-xs font-semibold tracking-widest uppercase text-[var(--accent)]">
            Founding offer · limited spots
          </span>
          <p className="mt-2 text-lg md:text-xl font-semibold text-[var(--text-primary)]">
            Lock in full Pro access for{' '}
            <span className="text-[var(--accent)]">$99/mo for life</span> — $50/mo off regular Pro pricing, forever.
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Same as the <span className="text-[var(--text-primary)] font-medium">Pro plan ($149/mo)</span> below — 50 students, custom branding, the works. Founding price never goes up.
          </p>
          <Link
            href="/signup?role=coach&plan=founding"
            className="mt-4 inline-block rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--text-on-accent)] shadow-lg shadow-[var(--accent)]/20 transition-all hover:bg-[var(--accent-hover)]"
          >
            Claim a founding spot
          </Link>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className={`relative rounded-2xl p-8 ${
                plan.popular
                  ? 'border-2 border-[var(--accent)] bg-[var(--accent)]/5'
                  : 'border border-[var(--border-subtle)] bg-[var(--bg-subtle)]'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent)] text-[var(--text-on-accent)]">
                  Most Popular
                </span>
              )}

              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{plan.name}</h3>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">{plan.description}</p>

              <div className="mt-6 mb-6">
                <span className="text-4xl font-bold text-[var(--text-primary)]">${plan.price}</span>
                <span className="text-sm text-[var(--text-tertiary)]">/mo</span>
              </div>

              <Link
                href={`/signup?role=coach&plan=${plan.name.toLowerCase()}`}
                className={`block text-center py-3 rounded-xl text-sm font-semibold transition-all ${
                  plan.popular
                    ? 'bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] shadow-lg shadow-[var(--accent)]/20'
                    : 'border border-white/40 bg-white/[0.12] text-[var(--text-primary)] hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/15'
                }`}
              >
                Start Free Trial
              </Link>

              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
                    <Check size={16} className="text-[var(--accent)] shrink-0 mt-0.5" />
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
