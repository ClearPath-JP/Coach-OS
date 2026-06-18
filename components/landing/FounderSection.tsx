'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export function FounderSection() {
  return (
    <section
      id="founder"
      className="relative border-b-[3px] border-[var(--ink)] bg-[var(--bg-app)] py-20 md:py-28"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-3xl px-6"
      >
        {/* Brutal card holding the founder story */}
        <div className="rounded-[20px] border-[3px] border-[var(--ink)] bg-white p-8 md:p-12 shadow-[7px_7px_0_var(--ink)] text-center">
          <span className="arcade-badge arcade-badge-coral">🥋 Why Korva</span>

          <h2 className="mt-5 font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-extrabold tracking-[-0.04em] leading-[1.05] text-[var(--ink)]">
            Built by a coach,
            <br />
            not a software company.
          </h2>

          <div className="mt-6 space-y-4 text-base md:text-lg font-medium text-[var(--text-secondary)] leading-relaxed">
            <p>
              I&apos;m a coach. I spent years running my dojo across a notebook, a spreadsheet,
              WhatsApp, Venmo, and a folder full of videos — none of them talking to each other.
            </p>
            <p>
              So I built the one tool I always wished I had: classes, payments, videos, and
              students in a single place that actually feels like a dojo, not a database.
            </p>
          </div>

          <p className="mt-6 font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--text-tertiary)]">
            Korva is in early access — I&apos;m personally onboarding the first 10 founding coaches by hand.
          </p>

          <div className="mt-8">
            <Link
              href="/signup?role=coach&plan=founding"
              className="group inline-flex items-center gap-2 font-[family-name:var(--font-display)] font-bold text-sm text-[var(--ink)] bg-[var(--belt-yellow)] border-[3px] border-[var(--ink)] rounded-[14px] px-7 py-3.5 shadow-[5px_5px_0_#b8910f] hover:-translate-x-px hover:-translate-y-px hover:shadow-[7px_7px_0_#b8910f] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all"
            >
              Start your free 14-day trial
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="mt-3 font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--text-tertiary)]">
              14 days free · $0 due today · then $99/mo · cancel anytime
            </p>
          </div>

          <p className="mt-8 font-[family-name:var(--font-display)] text-sm font-bold text-[var(--ink)]">
            — Josh, founder &amp; coach
          </p>
        </div>
      </motion.div>
    </section>
  )
}
