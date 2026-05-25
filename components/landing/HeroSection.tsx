'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Play, Sword, BookOpen, ArrowRight, CreditCard, Calendar } from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background image */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/images/hero-dojo.jpg)' }}
        />
        {/* Top-down gradient for nav legibility + bottom fade into page */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-app)]/85 via-[var(--bg-app)]/55 to-[var(--bg-app)]" />
        {/* Vignette to focus center */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,var(--bg-app)_95%)]" />
        {/* Warm lantern glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-[var(--accent)] opacity-[0.06] blur-[160px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 text-center">
        {/* KINDO brand mark — small, above the headline */}
        <motion.div
          custom={0}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mb-6"
        >
          <span
            className="font-[family-name:var(--font-display)] text-xs font-semibold tracking-[0.36em]"
            aria-label="Kindo"
          >
            <span className="text-white/85">KIN</span>
            <span className="font-bold" style={{ color: 'var(--accent)' }}>DO</span>
          </span>
        </motion.div>

        {/* Discipline tag */}
        <motion.div
          custom={1}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--accent)]/25 bg-[var(--bg-app)]/60 backdrop-blur-sm mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-[11px] font-medium tracking-[0.22em] uppercase text-[var(--accent)]">
            Focus. Train. Evolve.
          </span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          custom={2}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="font-[family-name:var(--font-display)] text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white leading-[0.95] tracking-tight"
        >
          Run your whole
          <br />
          <span style={{ color: 'var(--accent)' }}>dojo.</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          custom={3}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-8 text-lg md:text-xl text-white/75 max-w-2xl mx-auto leading-relaxed"
        >
          Videos, programs, payments, scheduling — every part of your
          coaching business in one place.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          custom={4}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/signup?role=coach"
            className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-xl text-white font-semibold text-base transition-all shadow-[0_8px_28px_rgba(var(--accent-rgb),0.35)] hover:shadow-[0_10px_36px_rgba(var(--accent-rgb),0.5)]"
            style={{ background: 'var(--accent)' }}
          >
            <Sword size={18} />
            Open Your Dojo
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/signup?role=student"
            className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-xl border border-white/30 bg-white/[0.1] backdrop-blur-sm text-white font-semibold text-base hover:border-[var(--accent)]/50 hover:bg-white/[0.16] transition-all"
          >
            <BookOpen size={18} />
            Find a Coach
          </Link>
        </motion.div>

        {/* Already a member — log in */}
        <motion.div
          custom={5}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-6"
        >
          <Link
            href="/login"
            className="text-sm text-white/55 hover:text-white transition-colors inline-flex items-center gap-1.5 group"
          >
            Already a member?
            <span className="font-medium text-white/85 group-hover:text-[var(--accent)] transition-colors">
              Log in
            </span>
            <ArrowRight size={13} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
          </Link>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          custom={6}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-14 flex flex-wrap items-center justify-center gap-3"
        >
          {[
            { icon: CreditCard, label: 'Payments' },
            { icon: Play, label: 'Video Library' },
            { icon: Calendar, label: 'Scheduling' },
            { icon: BookOpen, label: 'Student Portal' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-sm text-xs text-white/70"
            >
              <Icon size={13} style={{ color: 'var(--accent)' }} />
              {label}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom fade into page */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[var(--bg-app)] to-transparent" />
    </section>
  )
}
