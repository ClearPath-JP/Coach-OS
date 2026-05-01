'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Play, Sword, Dumbbell, BookOpen } from 'lucide-react'

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
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-app)]/70 via-[var(--bg-app)]/50 to-[var(--bg-app)]" />
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--bg-app)_100%)]" />
        {/* Warm accent glow from lanterns */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[var(--accent)] opacity-[0.06] blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 text-center">
        {/* Discipline tag */}
        <motion.div
          custom={0}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--accent)]/20 bg-[var(--bg-app)]/60 backdrop-blur-sm mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-xs font-medium tracking-widest uppercase text-[var(--accent)]">
            Discipline. Focus. Legacy.
          </span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          custom={1}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="font-[family-name:var(--font-display)] text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-[var(--text-primary)] leading-[1.05] tracking-tight"
        >
          Master the
          <br />
          <span className="text-[var(--accent)]">Path Within</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          custom={2}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-6 text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed"
        >
          The platform where martial arts and fitness coaches build their dojo online.
          Share videos, create programs, grow your students.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          custom={3}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/signup?role=coach"
            className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-[var(--accent)] text-[var(--text-on-accent)] font-semibold text-base hover:bg-[var(--accent-hover)] transition-all shadow-lg shadow-[var(--accent)]/20"
          >
            <Sword size={18} />
            I&apos;m a Coach
          </Link>
          <Link
            href="/signup?role=student"
            className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-app)]/40 backdrop-blur-sm text-[var(--text-primary)] font-semibold text-base hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 transition-all"
          >
            <BookOpen size={18} />
            I&apos;m a Student
          </Link>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          custom={4}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-16 flex items-center justify-center gap-8 md:gap-16"
        >
          {[
            { value: '500+', label: 'Active Students' },
            { value: '50+', label: 'Coaches' },
            { value: '10K+', label: 'Videos Shared' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
                {stat.value}
              </div>
              <div className="text-xs text-[var(--text-tertiary)] mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Feature pills */}
        <motion.div
          custom={5}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-12 flex flex-wrap items-center justify-center gap-3"
        >
          {[
            { icon: Play, label: 'Video Library' },
            { icon: Sword, label: 'Programs & Lessons' },
            { icon: Dumbbell, label: 'Workouts & Nutrition' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)]/50 backdrop-blur-sm text-sm text-[var(--text-secondary)]"
            >
              <Icon size={14} className="text-[var(--accent)]" />
              {label}
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--bg-app)] to-transparent" />
    </section>
  )
}
