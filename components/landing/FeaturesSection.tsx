'use client'

import { motion } from 'framer-motion'

type Feature = {
  emoji: string
  title: string
  description: string
  /** Tailwind tile utility for the colored block */
  tile: string
  /** Hard shadow color tuned to the belt */
  shadow: string
  /** true = white/ink text on a dark belt */
  light?: boolean
  badge?: string
}

const features: Feature[] = [
  {
    emoji: '🎥',
    title: 'Video Library',
    description:
      'Upload, organize, and share technique videos with thumbnails, categories, and durations. Your content, your way.',
    tile: 'tile-blue',
    shadow: 'shadow-[5px_5px_0_#1e5bc2]',
    light: true,
  },
  {
    emoji: '📚',
    title: 'Programs & Lessons',
    description:
      'Build structured curricula — week by week, lesson by lesson. Students track their progress through each module.',
    tile: 'tile-violet',
    shadow: 'shadow-[5px_5px_0_#7c4fc7]',
  },
  {
    emoji: '🥋',
    title: 'Your Dojo, Your Community',
    description:
      'Each coach runs their own dojo. Students see their classmates, share wins, and train together — even remotely.',
    tile: 'tile-teal',
    shadow: 'shadow-[5px_5px_0_#1a8a80]',
    light: true,
  },
  {
    emoji: '💬',
    title: 'Dojo Chat',
    description:
      'Group channels for technique talk, nutrition tips, and daily motivation. DMs for private coaching moments.',
    tile: 'tile-coral',
    shadow: 'shadow-[5px_5px_0_#cc2929]',
    light: true,
  },
  {
    emoji: '📤',
    title: 'Student Uploads',
    description:
      'Students film their practice and upload for coach review. Toggle visibility: private, coach-only, or share with the class.',
    tile: 'tile-yellow',
    shadow: 'shadow-[5px_5px_0_#b8910f]',
  },
  {
    emoji: '🏆',
    title: 'Progress Tracking',
    description:
      'Courses in progress, achievements earned, hours trained. Students see their growth. Coaches see who needs attention.',
    tile: 'tile-violet',
    shadow: 'shadow-[5px_5px_0_#7c4fc7]',
  },
  {
    emoji: '🔒',
    title: 'Paid or Private Access',
    description:
      'Set a monthly subscription price or share access codes. You control who enters your dojo.',
    tile: 'arcade-tile bg-white',
    shadow: 'shadow-[5px_5px_0_var(--ink)]',
  },
  {
    emoji: '📍',
    title: 'Find Local Clients',
    description:
      'Coming soon: type your city and Korva surfaces nearby prospects to reach out to — a lead engine built in, not bolted on.',
    tile: 'tile-yellow',
    shadow: 'shadow-[5px_5px_0_#b8910f]',
    badge: 'Coming soon',
  },
]

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative border-b-[3px] border-[var(--ink)] bg-[var(--bg-app)] py-20 md:py-28"
    >
      <div className="relative mx-auto max-w-6xl px-6">
        {/* Section header */}
        <div className="text-center mb-12 md:mb-14">
          <span className="font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            One tool. The whole practice.
          </span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-[-0.04em] leading-[1.05] text-[var(--ink)]">
            Everything a coach juggles
            <br />
            <span style={{ color: 'var(--belt-teal)' }}>finally unified.</span>
          </h2>
        </div>

        {/* Feature tiles */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className={`arcade-lift relative ${feature.tile} ${feature.shadow} p-6`}
            >
              {feature.badge && (
                <span className="arcade-badge arcade-badge-dark absolute top-4 right-4 !text-[10px]">
                  {feature.badge}
                </span>
              )}
              <div className="text-4xl mb-4" aria-hidden="true">{feature.emoji}</div>
              <h3
                className={`font-[family-name:var(--font-display)] text-lg font-extrabold tracking-[-0.02em] mb-2 ${
                  feature.light ? 'text-[var(--ink)]' : 'text-[var(--ink)]'
                }`}
              >
                {feature.title}
              </h3>
              <p
                className={`text-sm font-medium leading-relaxed ${
                  feature.light ? 'text-[var(--ink)]/80' : 'text-[var(--text-secondary)]'
                }`}
              >
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
