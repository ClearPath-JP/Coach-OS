'use client'

import { motion } from 'framer-motion'

type Testimonial = {
  quote: string
  name: string
  role: string
  initials: string
  /** card background utility (belt color) */
  card: string
  /** hard shadow color tuned to the belt */
  shadow: string
  /** avatar belt class */
  avatar: string
  /** true = white text on a dark belt card */
  light?: boolean
}

const testimonials: Testimonial[] = [
  {
    quote: 'Korva replaced 5 apps. I run my whole gym from my phone now.',
    name: 'Elena R.',
    role: 'Kickboxing coach',
    initials: 'ER',
    card: 'bg-[var(--belt-yellow)]',
    shadow: 'shadow-[5px_5px_0_#b8910f]',
    avatar: 'bg-[var(--belt-coral)] text-white',
  },
  {
    quote: 'Booking + payments in one tap. My students actually show up.',
    name: 'Dré M.',
    role: 'BJJ coach',
    initials: 'DM',
    card: 'bg-[var(--belt-violet)]',
    shadow: 'shadow-[5px_5px_0_#7c4fc7]',
    avatar: 'bg-[var(--belt-blue)] text-white',
  },
  {
    quote: 'Set it up in an afternoon. Looks like I hired a designer.',
    name: 'Sam T.',
    role: 'Strength coach',
    initials: 'ST',
    card: 'bg-[var(--belt-blue)]',
    shadow: 'shadow-[5px_5px_0_#1e5bc2]',
    avatar: 'bg-[var(--belt-yellow)] text-[var(--ink)]',
    light: true,
  },
]

export function CoachSpotlightSection() {
  return (
    <section
      id="coaches"
      className="relative border-b-[3px] border-[var(--ink)] bg-[var(--belt-teal)] py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        {/* Section header */}
        <div className="text-center mb-10 md:mb-12">
          <span className="font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink)]/55">
            Coaches who switched
          </span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-[-0.04em] leading-[1.05] text-[var(--ink)]">
            They run whole gyms
            <br />
            from their phones.
          </h2>
        </div>

        {/* Testimonial cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className={`arcade-lift rounded-[16px] border-[3px] border-[var(--ink)] ${t.card} ${t.shadow} p-7`}
            >
              <div className={`text-3xl mb-3 ${t.light ? 'text-white' : 'text-[var(--ink)]'}`}>
                &ldquo;
              </div>
              <p
                className={`font-[family-name:var(--font-display)] text-base font-bold leading-snug mb-6 ${
                  t.light ? 'text-white' : 'text-[var(--ink)]'
                }`}
              >
                {t.quote}
              </p>
              <div
                className={`flex items-center gap-3 pt-4 border-t-[3px] ${
                  t.light ? 'border-white/30' : 'border-[var(--ink)]/15'
                }`}
              >
                <span
                  className={`grid h-10 w-10 place-content-center rounded-[10px] border-2 border-[var(--ink)] font-[family-name:var(--font-display)] text-xs font-extrabold shadow-[2px_2px_0_var(--ink)] ${t.avatar}`}
                >
                  {t.initials}
                </span>
                <div>
                  <div className="font-[family-name:var(--font-display)] text-sm font-bold leading-tight">
                    <span className={t.light ? 'text-white' : 'text-[var(--ink)]'}>{t.name}</span>
                  </div>
                  <div
                    className={`font-[family-name:var(--font-display)] text-xs font-medium ${
                      t.light ? 'text-white/70' : 'text-[var(--ink)]/65'
                    }`}
                  >
                    {t.role}
                  </div>
                </div>
                <div className="ml-auto text-[var(--belt-coral)] text-sm">★★★★★</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
