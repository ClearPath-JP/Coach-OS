'use client'

import { motion } from 'framer-motion'
import {
  Video,
  BookOpen,
  Users,
  MessageCircle,
  Trophy,
  Upload,
  Lock,
  MapPin,
} from 'lucide-react'

const features = [
  {
    icon: MapPin,
    title: 'Find Local Clients',
    description: 'Type your city — Kindo pulls a list of local prospects from Instagram you can DM today. Built-in lead engine, not a third-party plugin.',
    accent: true,
  },
  {
    icon: Video,
    title: 'Video Library',
    description: 'Upload, organize, and share technique videos with thumbnails, categories, and durations. Your content, your way.',
  },
  {
    icon: BookOpen,
    title: 'Programs & Lessons',
    description: 'Build structured curricula — week by week, lesson by lesson. Students track their progress through each module.',
  },
  {
    icon: Users,
    title: 'Your Dojo, Your Community',
    description: 'Each coach runs their own dojo. Students see their classmates, share wins, and train together — even remotely.',
  },
  {
    icon: MessageCircle,
    title: 'Dojo Chat',
    description: 'Group channels for technique talk, nutrition tips, and daily motivation. DMs for private coaching moments.',
  },
  {
    icon: Upload,
    title: 'Student Uploads',
    description: 'Students film their practice and upload for coach review. Toggle visibility: private, coach-only, or share with the class.',
  },
  {
    icon: Trophy,
    title: 'Progress Tracking',
    description: 'Courses in progress, achievements earned, hours trained. Students see their growth. Coaches see who needs attention.',
  },
  {
    icon: Lock,
    title: 'Paid or Private Access',
    description: 'Set a monthly subscription price or share access codes. You control who enters your dojo.',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-24 md:py-32">
      {/* Accent glow */}
      <div className="absolute top-1/2 left-0 w-[400px] h-[400px] rounded-full bg-[var(--accent)] opacity-[0.03] blur-[100px]" />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="text-xs font-semibold tracking-widest uppercase text-[var(--accent)]">
            Features
          </span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold text-[var(--text-primary)]">
            One dojo. Every tool.
          </h2>
          <p className="mt-4 text-[var(--text-secondary)] max-w-lg mx-auto">
            Video-first. Community-driven. Built by a coach who got tired of juggling 5 different apps.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.03, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className={`group relative p-6 rounded-2xl border transition-colors ${
                feature.accent
                  ? 'border-[var(--accent)]/30 bg-[var(--accent)]/5 hover:border-[var(--accent)]/50'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] hover:border-[var(--accent)]/20'
              }`}
            >
              {feature.accent && (
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-[0.14em] bg-[var(--accent)] text-[var(--text-on-accent)]">
                  Lead Engine
                </span>
              )}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
                feature.accent
                  ? 'bg-[var(--accent)]/20'
                  : 'bg-[var(--accent)]/10'
              }`}>
                <feature.icon size={18} className="text-[var(--accent)]" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                {feature.title}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
