'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export function FounderSection() {
  return (
    <section id="founder" className="relative py-24 md:py-32">
      {/* Soft accent glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-[var(--accent)] opacity-[0.04] blur-[130px]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-3xl px-6 text-center"
      >
        <span className="text-xs font-semibold tracking-widest uppercase text-[var(--accent)]">
          Why Kindo
        </span>
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold text-[var(--text-primary)]">
          Built by a coach, not a software company.
        </h2>

        <div className="mt-6 space-y-4 text-lg text-[var(--text-secondary)] leading-relaxed">
          <p>
            I&apos;m a coach. I spent years running my dojo across a notebook, a spreadsheet,
            WhatsApp, Venmo, and a folder full of videos — none of them talking to each other.
          </p>
          <p>
            So I built the one tool I always wished I had: classes, payments, videos, and
            students in a single place that actually feels like a dojo, not a database.
          </p>
        </div>

        <p className="mt-6 text-sm text-[var(--text-tertiary)]">
          Kindo is in early access — I&apos;m personally onboarding the first 10 founding coaches by hand.
        </p>

        <div className="mt-8">
          <Link
            href="/signup?role=coach"
            className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--accent)] text-[var(--text-on-accent)] font-semibold text-sm hover:bg-[var(--accent-hover)] transition-all shadow-lg shadow-[var(--accent)]/20"
          >
            Become a founding coach
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <p className="mt-8 font-[family-name:var(--font-display)] text-[var(--text-secondary)]">
          — Josh, founder &amp; coach
        </p>
      </motion.div>
    </section>
  )
}
