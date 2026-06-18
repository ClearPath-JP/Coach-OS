'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

/**
 * "See inside Korva" — real product screenshots (coach desktop + student mobile),
 * captured from the live app. Shows what a coach AND their students actually get,
 * which answers the make-or-break question: "will my students use this?"
 * Screenshots live in /public/shots (captured via screenshots/capture-product-shots.mjs).
 */

const fade = {
  hidden: { opacity: 0, y: 22 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

function BrowserFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-[16px] border-[3px] border-[var(--ink)] bg-white shadow-[6px_6px_0_var(--ink)]">
      <div className="flex items-center gap-1.5 border-b-[3px] border-[var(--ink)] bg-[var(--bg-app)] px-3.5 py-2.5">
        <span className="size-3 rounded-full border-2 border-[var(--ink)] bg-[var(--belt-coral)]" />
        <span className="size-3 rounded-full border-2 border-[var(--ink)] bg-[var(--belt-yellow)]" />
        <span className="size-3 rounded-full border-2 border-[var(--ink)] bg-[var(--belt-teal)]" />
        <span className="ml-2 truncate font-[family-name:var(--font-display)] text-[11px] font-bold text-[var(--text-tertiary)]">
          korvacoach.com
        </span>
      </div>
      <Image
        src={src}
        alt={alt}
        width={1360}
        height={850}
        sizes="(max-width: 1024px) 100vw, 560px"
        className="block h-auto w-full"
      />
    </div>
  )
}

function PhoneFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="w-[230px] shrink-0 overflow-hidden rounded-[30px] border-[3px] border-[var(--ink)] bg-[var(--ink)] p-1.5 shadow-[6px_6px_0_var(--ink)] sm:w-[248px]">
      <div className="overflow-hidden rounded-[24px] border-2 border-[var(--ink)] bg-white">
        <Image
          src={src}
          alt={alt}
          width={390}
          height={844}
          sizes="248px"
          className="block h-auto w-full"
        />
      </div>
    </div>
  )
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-center text-[14px] font-medium leading-relaxed text-[var(--text-secondary)] sm:text-left">
      {children}
    </p>
  )
}

export function ShowcaseSection() {
  return (
    <section id="see-inside" className="relative border-b-[3px] border-[var(--ink)] bg-[var(--bg-subtle)] py-20 md:py-28">
      <div className="relative mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <span className="font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            See it in action
          </span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-extrabold leading-[1.05] tracking-[-0.04em] text-[var(--ink)] sm:text-4xl md:text-5xl">
            The real product —
            <br />
            <span style={{ color: 'var(--belt-teal)' }}>not a mockup.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-[520px] text-base font-medium text-[var(--text-secondary)]">
            Exactly what you and your students see the moment you log in.
          </p>
        </div>

        {/* COACH side */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="arcade-badge arcade-badge-yellow">🥋 Your side</span>
          <h3 className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-[-0.02em] text-[var(--ink)] sm:text-2xl">
            Run the whole dojo from one screen
          </h3>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <motion.div custom={0} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={fade}>
            <BrowserFrame src="/shots/coach-dashboard.png" alt="Korva coach dashboard — students, revenue, today's sessions, and who needs attention" />
            <Caption>
              <strong className="font-bold text-[var(--ink)]">Your command center.</strong> Every student, this month&apos;s revenue, today&apos;s
              sessions, and who needs a nudge — at a glance.
            </Caption>
          </motion.div>
          <motion.div custom={1} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={fade}>
            <BrowserFrame src="/shots/coach-clients.png" alt="Korva client roster — each student's program progress and check-ins" />
            <Caption>
              <strong className="font-bold text-[var(--ink)]">Every student, tracked.</strong> Belts, program progress, and check-ins for your
              whole roster in one place.
            </Caption>
          </motion.div>
          <motion.div custom={2} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={fade}>
            <BrowserFrame src="/shots/coach-payments.png" alt="Korva payments — money in this month, this week, all-time, and every payment logged" />
            <Caption>
              <strong className="font-bold text-[var(--ink)]">Get paid, see it all.</strong> Log cash, Venmo, Zelle or card — this month, this
              week, and all-time totals add themselves up.
            </Caption>
          </motion.div>
          <motion.div custom={3} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={fade}>
            <BrowserFrame src="/shots/coach-videos.png" alt="Korva video library — the coach's technique videos, organized by category" />
            <Caption>
              <strong className="font-bold text-[var(--ink)]">Your technique library.</strong> Upload once, organize by category, and share the
              right videos with the right students.
            </Caption>
          </motion.div>
        </div>

        {/* STUDENT side */}
        <div className="mt-16 mb-2 flex flex-wrap items-center gap-3 md:mt-20">
          <span className="arcade-badge arcade-badge-teal">📱 Their side</span>
          <h3 className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-[-0.02em] text-[var(--ink)] sm:text-2xl">
            Your students get their own app
          </h3>
        </div>
        <p className="mb-9 max-w-[560px] text-base font-medium text-[var(--text-secondary)]">
          The make-or-break question is <em>&ldquo;will my students actually use it?&rdquo;</em> — so Korva is built for them too: a clean
          space to book, check in, and rewatch your lessons from their phone.
        </p>
        <div className="flex flex-wrap items-start justify-center gap-x-10 gap-y-8 sm:gap-x-14">
          <motion.div custom={0} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={fade} className="flex flex-col items-center">
            <PhoneFrame src="/shots/student-portal.png" alt="Korva student portal — book a class, daily check-in, watch videos" />
            <p className="mt-3 max-w-[230px] text-center text-[13px] font-medium leading-relaxed text-[var(--text-secondary)]">
              <strong className="font-bold text-[var(--ink)]">Their home base</strong> — book classes, daily check-ins, message you.
            </p>
          </motion.div>
          <motion.div custom={1} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={fade} className="flex flex-col items-center">
            <PhoneFrame src="/shots/student-videos.png" alt="Korva student video library — rewatch the coach's technique videos" />
            <p className="mt-3 max-w-[230px] text-center text-[13px] font-medium leading-relaxed text-[var(--text-secondary)]">
              <strong className="font-bold text-[var(--ink)]">Your videos, theirs to rewatch</strong> — technique on demand, anytime.
            </p>
          </motion.div>
          <motion.div custom={2} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={fade} className="flex flex-col items-center">
            <PhoneFrame src="/shots/chat.png" alt="Korva student messaging — a direct chat thread with their coach" />
            <p className="mt-3 max-w-[230px] text-center text-[13px] font-medium leading-relaxed text-[var(--text-secondary)]">
              <strong className="font-bold text-[var(--ink)]">A direct line to you</strong> — questions, check-ins, and accountability between sessions.
            </p>
          </motion.div>
        </div>

        {/* CTA */}
        <div className="mt-14 text-center md:mt-16">
          <Link
            href="/signup?role=coach"
            className="inline-flex items-center gap-2 rounded-[14px] border-[3px] border-[var(--ink)] bg-[var(--belt-yellow)] px-6 py-3.5 font-[family-name:var(--font-display)] text-base font-bold text-[var(--ink)] shadow-[5px_5px_0_#b8910f] transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-[7px_7px_0_#b8910f] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          >
            Start your free 14-day trial <ArrowRight size={16} />
          </Link>
          <p className="mt-3 font-[family-name:var(--font-display)] text-[13px] font-semibold text-[var(--text-tertiary)]">
            14 days free · $0 due today · then $99/mo · cancel anytime
          </p>
        </div>
      </div>
    </section>
  )
}
