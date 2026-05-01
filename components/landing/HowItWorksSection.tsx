'use client'

import { motion } from 'framer-motion'
import { UserPlus, Search, Video } from 'lucide-react'

const steps = [
  {
    icon: UserPlus,
    number: '01',
    title: 'Join as Coach or Student',
    description: 'Create your profile with a real photo. Coaches set up their dojo — name it, set your price, add your style.',
  },
  {
    icon: Search,
    number: '02',
    title: 'Find Your Dojo',
    description: 'Students browse coaches by discipline, subscribe monthly, or enter an access code. Join multiple dojos at once.',
  },
  {
    icon: Video,
    number: '03',
    title: 'Train, Share, Grow',
    description: 'Coaches post videos, build programs, and share knowledge. Students upload progress, chat with the class, level up.',
  },
]

export function HowItWorksSection() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="text-xs font-semibold tracking-widest uppercase text-[var(--accent)]">
            How it works
          </span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold text-[var(--text-primary)]">
            Three steps to your online dojo
          </h2>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ delay: i * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="group relative p-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] hover:border-[var(--accent)]/30 transition-colors"
            >
              {/* Step number */}
              <span className="absolute top-6 right-6 text-5xl font-bold text-[var(--text-quaternary)]/30 font-[family-name:var(--font-display)]">
                {step.number}
              </span>

              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center mb-6">
                <step.icon size={22} className="text-[var(--accent)]" />
              </div>

              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                {step.title}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
