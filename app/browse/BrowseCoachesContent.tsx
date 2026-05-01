'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Star, Users, ArrowRight, Filter, KeyRound } from 'lucide-react'

const styles = ['All', 'Martial Arts', 'Strength', 'Yoga', 'Nutrition', 'Boxing', 'BJJ', 'MMA']

const allCoaches = [
  {
    id: '1',
    name: 'Coach Mike',
    dojo: 'Muay Thai Flow',
    style: 'Muay Thai',
    bio: 'Former pro fighter. 12 years teaching. Focus on flow, timing, and fight IQ.',
    price: 79,
    students: 24,
    rating: 4.8,
    videos: 86,
    color: '#E8A948',
  },
  {
    id: '2',
    name: 'Coach Sarah',
    dojo: 'Iron Body',
    style: 'Strength',
    bio: 'CSCS certified. Building strong, resilient athletes through progressive overload.',
    price: 49,
    students: 12,
    rating: 4.9,
    videos: 54,
    color: '#5A8A4A',
  },
  {
    id: '3',
    name: 'Coach Renzo',
    dojo: 'Ground Game Academy',
    style: 'BJJ',
    bio: 'Black belt, 3x world champion. Specializing in no-gi and submission wrestling.',
    price: 99,
    students: 31,
    rating: 4.7,
    videos: 142,
    color: '#6A8AA4',
  },
  {
    id: '4',
    name: 'Coach Priya',
    dojo: 'Temple Strength',
    style: 'Yoga',
    bio: 'Yoga for fighters. Mobility, recovery, and mental clarity for combat athletes.',
    price: 39,
    students: 45,
    rating: 4.9,
    videos: 67,
    color: '#8B3A3A',
  },
  {
    id: '5',
    name: 'Coach Dre',
    dojo: 'Southpaw Boxing Lab',
    style: 'Boxing',
    bio: 'Teaching the sweet science. Footwork, defense, and precision punching.',
    price: 69,
    students: 19,
    rating: 4.6,
    videos: 93,
    color: '#C4A44A',
  },
  {
    id: '6',
    name: 'Coach Alina',
    dojo: 'Fuel & Form',
    style: 'Nutrition',
    bio: 'Sports dietitian. Meal plans, macros, and performance nutrition for athletes.',
    price: 59,
    students: 38,
    rating: 4.8,
    videos: 41,
    color: '#8A7A5A',
  },
]

export function BrowseCoachesContent() {
  const [search, setSearch] = useState('')
  const [activeStyle, setActiveStyle] = useState('All')
  const [showAccessCode, setShowAccessCode] = useState(false)
  const [accessCode, setAccessCode] = useState('')

  const filtered = allCoaches.filter((coach) => {
    const matchesSearch =
      search === '' ||
      coach.name.toLowerCase().includes(search.toLowerCase()) ||
      coach.dojo.toLowerCase().includes(search.toLowerCase()) ||
      coach.style.toLowerCase().includes(search.toLowerCase())
    const matchesStyle = activeStyle === 'All' || coach.style === activeStyle
    return matchesSearch && matchesStyle
  })

  return (
    <section className="py-12 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="mb-10">
          <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold text-[var(--text-primary)]">
            Find Your Coach
          </h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            Browse coaches by discipline. Subscribe to join their dojo.
          </p>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="text"
              placeholder="Search coaches, styles, dojos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]/40 transition-colors"
            />
          </div>
          <button
            onClick={() => setShowAccessCode(!showAccessCode)}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] text-sm text-[var(--text-secondary)] hover:border-[var(--accent)]/40 transition-colors"
          >
            <KeyRound size={14} />
            Enter Access Code
          </button>
        </div>

        {/* Access code input */}
        {showAccessCode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-8 p-5 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5"
          >
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              Have an access code from a coach? Enter it below to join their dojo directly.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="e.g. FLOW24"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                className="flex-1 max-w-xs px-4 py-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] text-sm text-[var(--text-primary)] font-mono uppercase tracking-widest placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent)]/40"
              />
              <button className="px-5 py-2.5 rounded-lg bg-[var(--accent)] text-[var(--text-on-accent)] text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors">
                Join Dojo
              </button>
            </div>
          </motion.div>
        )}

        {/* Style filter pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          {styles.map((style) => (
            <button
              key={style}
              onClick={() => setActiveStyle(style)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeStyle === style
                  ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
                  : 'border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent)]/30'
              }`}
            >
              {style}
            </button>
          ))}
        </div>

        {/* Results count */}
        <p className="text-xs text-[var(--text-tertiary)] mb-6">
          {filtered.length} coach{filtered.length !== 1 ? 'es' : ''} found
        </p>

        {/* Coach cards grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((coach, i) => (
            <motion.div
              key={coach.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] overflow-hidden hover:border-[var(--accent)]/30 transition-all"
            >
              {/* Banner */}
              <div
                className="h-28 relative"
                style={{
                  background: `linear-gradient(135deg, ${coach.color}25, ${coach.color}08)`,
                }}
              >
                <div className="absolute top-4 right-4 px-2.5 py-1 rounded-md bg-[var(--bg-app)]/80 backdrop-blur text-xs font-medium text-[var(--text-secondary)]">
                  {coach.style}
                </div>
                <div
                  className="absolute -bottom-7 left-6 w-16 h-16 rounded-xl border-3 border-[var(--bg-subtle)] flex items-center justify-center text-xl font-bold shadow-md"
                  style={{
                    background: `linear-gradient(135deg, ${coach.color}, ${coach.color}CC)`,
                    color: 'var(--bg-app)',
                    borderWidth: '3px',
                  }}
                >
                  {coach.name.split(' ')[1]?.[0] ?? coach.name[0]}
                </div>
              </div>

              {/* Info */}
              <div className="pt-11 px-6 pb-6">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  {coach.dojo}
                </h3>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  {coach.name}
                </p>
                <p className="text-sm text-[var(--text-secondary)] mt-3 leading-relaxed line-clamp-2">
                  {coach.bio}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-4 mt-4 text-xs text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1">
                    <Star size={12} className="text-[var(--accent)]" fill="var(--accent)" />
                    {coach.rating}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {coach.students}
                  </span>
                  <span>{coach.videos} videos</span>
                </div>

                {/* Price + Join */}
                <div className="flex items-center justify-between mt-5 pt-4 border-t border-[var(--border-subtle)]">
                  <div>
                    <span className="text-xl font-bold text-[var(--text-primary)]">${coach.price}</span>
                    <span className="text-xs text-[var(--text-tertiary)]">/mo</span>
                  </div>
                  <button className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-[var(--text-on-accent)] text-xs font-semibold hover:bg-[var(--accent-hover)] transition-colors shadow-sm">
                    Join Dojo
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-20">
            <Filter size={32} className="mx-auto text-[var(--text-quaternary)] mb-4" />
            <p className="text-[var(--text-secondary)]">No coaches match your filters.</p>
            <button
              onClick={() => { setSearch(''); setActiveStyle('All') }}
              className="mt-3 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
