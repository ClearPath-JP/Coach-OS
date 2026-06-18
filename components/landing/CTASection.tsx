'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="relative border-b-[3px] border-[var(--ink)] bg-[var(--bg-app)] py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[24px] border-[3px] border-[var(--ink)] bg-[var(--belt-yellow)] p-12 md:p-16 text-center shadow-[8px_8px_0_var(--ink)]"
        >
          <div className="relative z-10">
            <span className="arcade-badge arcade-badge-dark">🥋 The mat is ready</span>
            <h2 className="mt-5 font-[family-name:var(--font-display)] text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-[-0.04em] leading-[1.03] text-[var(--ink)]">
              Open your dojo today.
            </h2>
            <p className="mt-4 text-base md:text-lg font-medium text-[var(--ink)]/75 max-w-xl mx-auto">
              Start free for 14 days and set up in an afternoon. The first 10 founding coaches lock in
              $99/mo for life.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3">
              <Link
                href="/signup?role=coach"
                className="inline-flex items-center gap-2 font-[family-name:var(--font-display)] font-bold text-base text-[#faf7f0] bg-[var(--ink)] border-[3px] border-[var(--ink)] rounded-[14px] px-8 py-4 shadow-[5px_5px_0_#b8910f] hover:-translate-x-px hover:-translate-y-px hover:shadow-[7px_7px_0_#b8910f] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all"
              >
                Start your free 14-day trial
                <ArrowRight size={18} />
              </Link>
              <p className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--ink)]/70">
                14 days free · $0 due today · then $99/mo · cancel anytime
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
