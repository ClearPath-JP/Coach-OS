'use client'

import { Video, Lightbulb, MessageCircle } from 'lucide-react'
import type { Path } from './promote-shared'

const PATHS: { key: Path; label: string; desc: string; Icon: typeof Video }[] = [
  { key: 'video', label: 'I have a video', desc: 'Plan a Reel — hook, shot list, on-screen text + caption for your clip.', Icon: Video },
  { key: 'idea', label: 'Start from an idea', desc: 'Pick what you’re promoting and get a finished post or 5 angles.', Icon: Lightbulb },
  { key: 'chat', label: 'Talk it out', desc: 'Chat with AI about your coaching, then turn it into a post in your voice.', Icon: MessageCircle },
]

export function PathStep({ onPick }: { onPick: (p: Path) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--text-tertiary)]">How do you want to start?</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {PATHS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onPick(p.key)}
            className="group flex flex-col items-start gap-2.5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-5 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent)]/5"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--accent)]/12 text-[var(--accent)] transition-transform group-hover:scale-105">
              <p.Icon className="size-5" />
            </span>
            <span className="text-[15px] font-semibold text-[var(--text-primary)]">{p.label}</span>
            <span className="text-xs leading-relaxed text-[var(--text-tertiary)]">{p.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
