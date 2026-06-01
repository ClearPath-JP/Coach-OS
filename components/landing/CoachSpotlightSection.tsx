'use client'

import { motion } from 'framer-motion'
import { Star, Users, ArrowRight } from 'lucide-react'

const mockCoaches = [
  {
    name: 'Coach Mike',
    dojo: 'Muay Thai Flow',
    style: 'Muay Thai',
    price: 79,
    students: 24,
    rating: 4.8,
    avatar: null,
    color: '#E8A948',
  },
  {
    name: 'Coach Sarah',
    dojo: 'Iron Body',
    style: 'Strength & Conditioning',
    price: 49,
    students: 12,
    rating: 4.9,
    avatar: null,
    color: '#5A8A4A',
  },
  {
    name: 'Coach Renzo',
    dojo: 'Ground Game Academy',
    style: 'Brazilian Jiu-Jitsu',
    price: 99,
    students: 31,
    rating: 4.7,
    avatar: null,
    color: '#6A8AA4',
  },
  {
    name: 'Coach Priya',
    dojo: 'Temple Strength',
    style: 'Yoga & Nutrition',
    price: 39,
    students: 45,
    rating: 4.9,
    avatar: null,
    color: '#8B3A3A',
  },
]

export function CoachSpotlightSection() {
  return (
    <section id="coaches" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="text-xs font-semibold tracking-widest uppercase text-[var(--accent)]">
            Coaches
          </span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold text-[var(--text-primary)]">
            Train under real instructors
          </h2>
          <p className="mt-4 text-[var(--text-secondary)] max-w-lg mx-auto">
            Browse coaches by discipline. Find your style. Join their dojo.
          </p>
        </div>

        {/* Coach cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {mockCoaches.map((coach, i) => (
            <motion.div
              key={coach.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] overflow-hidden hover:border-[var(--accent)]/30 transition-all"
            >
              {/* Coach banner */}
              <div
                className="h-24 relative"
                style={{
                  background: `linear-gradient(135deg, ${coach.color}20, ${coach.color}08)`,
                }}
              >
                {/* Avatar placeholder */}
                <div
                  className="absolute -bottom-6 left-5 w-14 h-14 rounded-xl border-2 border-[var(--bg-subtle)] flex items-center justify-center text-lg font-bold"
                  style={{
                    background: `linear-gradient(135deg, ${coach.color}, ${coach.color}CC)`,
                    color: 'var(--bg-app)',
                  }}
                >
                  {coach.name.split(' ')[1]?.[0] ?? coach.name[0]}
                </div>
              </div>

              {/* Coach info */}
              <div className="pt-10 px-5 pb-5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  {coach.dojo}
                </h3>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  {coach.name} &middot; {coach.style}
                </p>

                {/* Stats row */}
                <div className="flex items-center gap-3 mt-4 text-xs text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1">
                    <Star size={12} className="text-[var(--accent)]" fill="var(--accent)" />
                    {coach.rating}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {coach.students} students
                  </span>
                </div>

                {/* Price + CTA */}
                <div className="flex items-center justify-between mt-5 pt-4 border-t border-[var(--border-subtle)]">
                  <span className="text-lg font-bold text-[var(--text-primary)]">
                    ${coach.price}
                    <span className="text-xs font-normal text-[var(--text-tertiary)]">/mo</span>
                  </span>
                  <button className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors flex items-center gap-1">
                    View Dojo
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Browse-all CTA hidden until the public /browse directory is wired to
            real coaches (it's currently mock data). Re-add:
            <Link href="/browse" …>Browse all coaches <ArrowRight/></Link> */}
      </div>
    </section>
  )
}
