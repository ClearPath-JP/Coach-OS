'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { SignupCard } from '@/components/auth/SignupCard'

type Step = 'choose' | 'coach' | 'student'

const ease = [0.16, 1, 0.3, 1] as const

const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
}

const item = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="mb-4 inline-flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-[13px] font-medium text-[var(--text-secondary)] p-0 hover:text-[var(--text-primary)] transition-colors duration-150"
      whileHover={{ x: -2 }}
      whileTap={{ scale: 0.97 }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
      </svg>
      Back
    </motion.button>
  )
}

export function SignupFlow() {
  const [step, setStep] = useState<Step>('choose')

  if (step === 'coach') {
    return (
      <motion.div key="coach" {...fadeSlide}>
        <BackButton onClick={() => setStep('choose')} />
        <SignupCard />
      </motion.div>
    )
  }

  if (step === 'student') {
    return (
      <motion.div key="student" {...fadeSlide} className="mx-auto flex max-w-[400px] flex-col items-center rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-6 py-8 text-center">
        <div className="self-start">
          <BackButton onClick={() => setStep('choose')} />
        </div>

        <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-[var(--bg-muted)]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="17" y1="11" x2="23" y2="11" />
          </svg>
        </div>

        <h1 className="font-display mb-3 text-[20px] font-medium leading-tight tracking-[0.01em] text-[var(--text-primary)]">
          Students don&apos;t sign up here
        </h1>

        <p className="mb-6 text-[14px] leading-relaxed text-[var(--text-secondary)]">
          Your coach creates your account and sends you a login link. If you haven&apos;t received one, ask your coach to invite you from their dashboard.
        </p>

        <button
          type="button"
          onClick={() => setStep('choose')}
          className="mb-4 h-11 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-app)] text-[14px] font-semibold text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--bg-emphasis)] cursor-pointer"
        >
          &larr; Back
        </button>

        <p className="text-[13px] text-[var(--text-secondary)]">
          Are you a coach?{' '}
          <button
            type="button"
            onClick={() => setStep('coach')}
            className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-semibold text-[var(--accent)] hover:underline"
          >
            Get started &rarr;
          </button>
        </p>
      </motion.div>
    )
  }

  // 'choose' step
  return (
    <motion.div className="mx-auto flex max-w-[420px] flex-col gap-5" variants={stagger} initial="initial" animate="animate">
      <motion.div variants={item} className="mb-2 text-center">
        <h1 className="font-display mb-2 text-[24px] font-medium tracking-[0.01em] text-[var(--text-primary)]">
          Join Sensei App
        </h1>
        <p className="section-label-accent">
          Who are you signing up as?
        </p>
      </motion.div>

      <motion.div variants={item} className="flex flex-col gap-3">
        {/* Coach card */}
        <motion.div
          className="rounded-[var(--radius-xl)] border-[1.5px] border-[var(--border-default)] bg-[var(--bg-subtle)] px-5 py-6"
          whileHover={{ scale: 1.01, borderColor: 'var(--accent-muted)' }}
          transition={{ duration: 0.2 }}
        >
          <div className="mb-4 flex items-start gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--accent-muted)] bg-[var(--accent-light)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            <div>
              <p className="mb-1 text-[16px] font-bold text-[var(--text-primary)]">
                I&apos;m a Coach
              </p>
              <p className="text-[13px] leading-snug text-[var(--text-secondary)]">
                Create your coaching workspace
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStep('coach')}
            className="h-11 w-full cursor-pointer rounded-[var(--radius-md)] border-none bg-[var(--accent)] text-[14px] font-semibold text-white transition-colors duration-150 hover:bg-[var(--accent-hover)]"
          >
            Get started as a Coach
          </button>
        </motion.div>

        {/* Student card */}
        <motion.div
          className="rounded-[var(--radius-xl)] border-[1.5px] border-[var(--border-default)] bg-[var(--bg-subtle)] px-5 py-6"
          whileHover={{ scale: 1.01, borderColor: 'var(--border-strong)' }}
          transition={{ duration: 0.2 }}
        >
          <div className="mb-4 flex items-start gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-muted)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <p className="mb-1 text-[16px] font-bold text-[var(--text-primary)]">
                I&apos;m a Student
              </p>
              <p className="text-[13px] leading-snug text-[var(--text-secondary)]">
                Access your client portal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStep('student')}
            className="h-11 w-full cursor-pointer rounded-[var(--radius-md)] border-[1.5px] border-[var(--border-default)] bg-[var(--bg-app)] text-[14px] font-semibold text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--bg-emphasis)]"
          >
            I&apos;m a Student
          </button>
        </motion.div>
      </motion.div>

      <motion.p variants={item} className="text-center text-[13px] text-[var(--text-secondary)]">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-semibold text-[var(--accent)] no-underline hover:underline"
        >
          Sign in &rarr;
        </Link>
      </motion.p>
    </motion.div>
  )
}
