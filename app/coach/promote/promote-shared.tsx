'use client'

import { useState, type ReactNode } from 'react'
import { Ticket, Dumbbell, UserPlus, Clapperboard, Copy, Check, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Tone = 'hype' | 'calm' | 'friendly'
export type Kind = 'class' | 'workout' | 'book1on1' | 'bts'
export type Path = 'video' | 'idea' | 'chat'

export type Idea = { title: string; angle: string }
export type Post = {
  hook: string
  caption: string
  hashtags: string[]
  cta: string
  videoScript: string[] | null
}
export type VideoPlan = {
  hookIdea: string
  structure: string[]
  onScreenText: string[]
  caption: string
  hashtags: string[]
}
export type ChatMsg = { role: 'user' | 'assistant'; content: string }
export type PromoteResult = { type: 'post'; post: Post } | { type: 'video'; videoPlan: VideoPlan }

export type GenerateResponse = {
  data?:
    | { mode: 'ideas'; ideas: Idea[] }
    | { mode: 'post'; post: Post }
    | { mode: 'video'; videoPlan: VideoPlan }
  error?: string
}

export const KINDS: { key: Kind; label: string; hint: string; Icon: typeof Ticket; placeholder: string }[] = [
  { key: 'class', label: 'Class / session', hint: 'Fill seats', Icon: Ticket, placeholder: 'e.g. Saturday 9am beginners class — 4 spots left, first one free' },
  { key: 'workout', label: 'Workout / technique', hint: 'Show your expertise', Icon: Dumbbell, placeholder: 'e.g. 3 drills to fix a slow guard retention' },
  { key: 'book1on1', label: 'Book a 1:1', hint: 'Drive enquiries', Icon: UserPlus, placeholder: 'e.g. taking on 2 new private clients this month' },
  { key: 'bts', label: 'Behind the scenes', hint: 'Build trust', Icon: Clapperboard, placeholder: 'e.g. why I started coaching out of my garage' },
]

export const TONES: { key: Tone; label: string }[] = [
  { key: 'hype', label: 'Hype' },
  { key: 'calm', label: 'Calm' },
  { key: 'friendly', label: 'Friendly' },
]

export function fullCaption(p: Post): string {
  const tags = p.hashtags.length ? p.hashtags.map((h) => `#${h}`).join(' ') : ''
  return [p.hook, p.caption, p.cta, tags].filter(Boolean).join('\n\n')
}

export function videoPlanCaption(v: VideoPlan): string {
  const tags = v.hashtags.length ? v.hashtags.map((h) => `#${h}`).join(' ') : ''
  return [v.caption, tags].filter(Boolean).join('\n\n')
}

export function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500)
    } catch {
      /* clipboard blocked — no-op */
    }
  }
  return { copiedKey, copy }
}

export function CopyBtn({ onClick, copied, label }: { onClick: () => void; copied: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

export function ToneToggle({ value, onChange, disabled }: { value: Tone; onChange: (t: Tone) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--border-default)] p-0.5">
      {TONES.map((t) => {
        const on = t.key === value
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            disabled={disabled}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              on ? 'bg-[var(--accent)] text-[var(--text-on-accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
            aria-pressed={on}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export function StepProgress({ current, lastLabel, onJump }: { current: 1 | 2 | 3; lastLabel: string; onJump: (s: 1 | 2 | 3) => void }) {
  const steps: { n: 1 | 2 | 3; label: string }[] = [
    { n: 1, label: 'Path' },
    { n: 2, label: 'Create' },
    { n: 3, label: lastLabel },
  ]
  return (
    <ol className="flex items-center gap-1.5 text-[12px]">
      {steps.map((s, i) => {
        const done = s.n < current
        const active = s.n === current
        return (
          <li key={s.n} className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={s.n >= current}
              onClick={() => onJump(s.n)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors disabled:cursor-default',
                active ? 'bg-[var(--accent)]/12 text-[var(--accent)]' : done ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]' : 'text-[var(--text-quaternary)]'
              )}
            >
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full text-[10px] font-semibold',
                  active ? 'bg-[var(--accent)] text-[var(--text-on-accent)]' : done ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-[var(--bg-muted)] text-[var(--text-quaternary)]'
                )}
              >
                {done ? <Check className="size-3" /> : s.n}
              </span>
              {s.label}
            </button>
            {i < steps.length - 1 && <span className="h-px w-4 bg-[var(--border-default)] sm:w-6" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">{title}</p>
        {action}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

export function PostCard({ post }: { post: Post }) {
  const { copiedKey, copy } = useCopy()
  return (
    <div className="space-y-4">
      {post.hook && (
        <Section title="Hook">
          <p className="text-sm font-medium text-[var(--text-primary)]">{post.hook}</p>
        </Section>
      )}
      <Section
        title="Caption"
        action={<CopyBtn onClick={() => copy(fullCaption(post), 'cap')} copied={copiedKey === 'cap'} label="Copy caption" />}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">{post.caption}</p>
      </Section>
      {post.cta && (
        <Section title="Call to action">
          <p className="text-sm text-[var(--text-primary)]">{post.cta}</p>
        </Section>
      )}
      {post.hashtags.length > 0 && (
        <Section title="Hashtags">
          <div className="flex flex-wrap gap-1.5">
            {post.hashtags.map((h) => (
              <span key={h} className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[11px] text-[var(--text-tertiary)]">#{h}</span>
            ))}
          </div>
        </Section>
      )}
      {post.videoScript && post.videoScript.length > 0 && (
        <Section
          title="Reel / video script"
          action={<CopyBtn onClick={() => copy(post.videoScript!.join('\n'), 'scr')} copied={copiedKey === 'scr'} label="Copy script" />}
        >
          <ol className="space-y-1">
            {post.videoScript.map((line, i) => (
              <li key={i} className="flex gap-2 text-sm text-[var(--text-secondary)]">
                <span className="select-none font-semibold text-[var(--accent)]">{i + 1}.</span>
                {line}
              </li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  )
}

export function VideoPlanCard({ plan }: { plan: VideoPlan }) {
  const { copiedKey, copy } = useCopy()
  return (
    <div className="space-y-4">
      {plan.hookIdea && (
        <Section title="First 2 seconds (the hook)">
          <p className="text-sm font-medium text-[var(--text-primary)]">{plan.hookIdea}</p>
        </Section>
      )}
      {plan.structure.length > 0 && (
        <Section title="How to structure the clip" action={<CopyBtn onClick={() => copy(plan.structure.join('\n'), 'str')} copied={copiedKey === 'str'} label="Copy" />}>
          <ol className="space-y-1">
            {plan.structure.map((line, i) => (
              <li key={i} className="flex gap-2 text-sm text-[var(--text-secondary)]">
                <span className="select-none font-semibold text-[var(--accent)]">{i + 1}.</span>
                {line}
              </li>
            ))}
          </ol>
        </Section>
      )}
      {plan.onScreenText.length > 0 && (
        <Section title="On-screen text" action={<CopyBtn onClick={() => copy(plan.onScreenText.join('\n'), 'ost')} copied={copiedKey === 'ost'} label="Copy" />}>
          <ul className="space-y-1">
            {plan.onScreenText.map((line, i) => (
              <li key={i} className="rounded-md bg-[var(--bg-muted)] px-2.5 py-1.5 text-sm text-[var(--text-secondary)]">{line}</li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Caption" action={<CopyBtn onClick={() => copy(videoPlanCaption(plan), 'cap')} copied={copiedKey === 'cap'} label="Copy caption" />}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">{plan.caption}</p>
      </Section>
      {plan.hashtags.length > 0 && (
        <Section title="Hashtags">
          <div className="flex flex-wrap gap-1.5">
            {plan.hashtags.map((h) => (
              <span key={h} className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[11px] text-[var(--text-tertiary)]">#{h}</span>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

export function ResultActions({ caption }: { caption: string }) {
  const [state, setState] = useState<'ig' | 'fb' | null>(null)
  async function copyAndOpen(url: string, key: 'ig' | 'fb') {
    try {
      await navigator.clipboard.writeText(caption)
    } catch {
      /* clipboard blocked */
    }
    setState(key)
    window.setTimeout(() => setState((s) => (s === key ? null : s)), 1500)
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-4">
      <button
        type="button"
        onClick={() => copyAndOpen('https://www.instagram.com/', 'ig')}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-on-accent)] transition-colors hover:bg-[var(--accent-hover)]"
      >
        <ExternalLink className="size-3.5" />
        {state === 'ig' ? 'Copied — opening…' : 'Copy & open Instagram'}
      </button>
      <button
        type="button"
        onClick={() => copyAndOpen('https://www.facebook.com/', 'fb')}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]"
      >
        <ExternalLink className="size-3.5" />
        {state === 'fb' ? 'Copied — opening…' : 'Copy & open Facebook'}
      </button>
    </div>
  )
}
