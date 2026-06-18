'use client'

import { motion } from 'framer-motion'

const steps = [
  {
    emoji: '🙌',
    number: '01',
    title: 'Join as Coach or Student',
    description:
      'Create your profile with a real photo. Coaches set up their dojo — name it, set your price, add your style.',
    tile: 'tile-yellow',
    shadow: 'shadow-[5px_5px_0_#b8910f]',
    badge: 'arcade-badge-yellow',
  },
  {
    emoji: '🚪',
    number: '02',
    title: 'Open the Doors',
    description:
      'Set your price, drop in your videos, share your access code. Students subscribe directly — no app store fees, no middleman cut.',
    tile: 'tile-violet',
    shadow: 'shadow-[5px_5px_0_#7c4fc7]',
    badge: 'arcade-badge-violet',
  },
  {
    emoji: '🥊',
    number: '03',
    title: 'Train, Share, Grow',
    description:
      'Coaches post videos, build programs, and share knowledge. Students upload progress, chat with the class, level up.',
    tile: 'tile-teal',
    shadow: 'shadow-[5px_5px_0_#1a8a80]',
    light: true,
    badge: 'arcade-badge-teal',
  },
]

export function HowItWorksSection() {
  return (
    <section className="relative border-b-[3px] border-[var(--ink)] bg-[var(--bg-app)] py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section header */}
        <div className="text-center mb-12 md:mb-14">
          <span className="font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            How it works
          </span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-[-0.04em] leading-[1.05] text-[var(--ink)]">
            Open the doors
            <br />
            <span style={{ color: 'var(--belt-violet)' }}>in three moves.</span>
          </h2>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-5">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ delay: i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className={`arcade-lift relative overflow-hidden ${step.tile} ${step.shadow} p-7`}
            >
              {/* Step number — oversized ghost numeral */}
              <span
                className={`pointer-events-none absolute -top-2 right-3 font-[family-name:var(--font-display)] text-7xl font-extrabold tracking-[-0.04em] ${
                  step.light ? 'text-[var(--ink)]/20' : 'text-[var(--ink)]/15'
                }`}
              >
                {step.number}
              </span>

              {/* Icon coin */}
              <div
                className="relative grid h-14 w-14 place-content-center rounded-[12px] border-[3px] border-[var(--ink)] bg-white text-2xl shadow-[3px_3px_0_var(--ink)] mb-5"
                aria-hidden="true"
              >
                {step.emoji}
              </div>

              <h3
                className={`font-[family-name:var(--font-display)] text-xl font-extrabold tracking-[-0.02em] mb-2.5 ${
                  step.light ? 'text-[var(--ink)]' : 'text-[var(--ink)]'
                }`}
              >
                {step.title}
              </h3>
              <p
                className={`text-sm font-medium leading-relaxed ${
                  step.light ? 'text-[var(--ink)]/80' : 'text-[var(--text-secondary)]'
                }`}
              >
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
