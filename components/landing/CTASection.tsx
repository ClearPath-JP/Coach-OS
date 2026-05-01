'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-3xl border border-[var(--accent)]/20 bg-gradient-to-br from-[var(--accent)]/8 to-[var(--accent)]/3 p-12 md:p-20 text-center overflow-hidden"
        >
          {/* Background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[var(--accent)] opacity-[0.06] blur-[100px]" />

          <div className="relative z-10">
            <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-5xl font-bold text-[var(--text-primary)] leading-tight">
              Your dojo is waiting
            </h2>
            <p className="mt-4 text-[var(--text-secondary)] text-lg max-w-xl mx-auto">
              Whether you&apos;re a coach ready to take your teaching online, or a student looking for real instruction — start here.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[var(--accent)] text-[var(--text-on-accent)] font-semibold hover:bg-[var(--accent-hover)] transition-all shadow-lg shadow-[var(--accent)]/20"
              >
                Begin Your Journey
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
