'use client'

import { useState } from 'react'
import { Lightbulb, Wand2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KINDS, type Kind, type Tone, type Idea, type PromoteResult, type GenerateResponse } from './promote-shared'

export function IdeaStep({
  discipline,
  tone,
  onDone,
}: {
  discipline: string
  tone: Tone
  onDone: (r: PromoteResult) => void
}) {
  const [kind, setKind] = useState<Kind>('class')
  const [topic, setTopic] = useState('')
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState<'ideas' | 'post' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const activeKind = KINDS.find((k) => k.key === kind) ?? KINDS[0]
  const busy = loading !== null

  async function generate(mode: 'ideas' | 'post', topicOverride?: string) {
    setError(null)
    setLoading(mode)
    try {
      const res = await fetch('/api/coach/promote/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kind,
          mode,
          tone,
          discipline: discipline || undefined,
          topic: (topicOverride ?? topic).trim() || undefined,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as GenerateResponse
      if (!res.ok) {
        setError(json.error ?? 'Could not generate — try again')
        return
      }
      if (json.data?.mode === 'ideas') setIdeas(json.data.ideas)
      else if (json.data?.mode === 'post') onDone({ type: 'post', post: json.data.post })
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-5">
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
          What are you promoting?
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {KINDS.map((k) => {
            const on = k.key === kind
            return (
              <button
                key={k.key}
                type="button"
                onClick={() => setKind(k.key)}
                disabled={busy}
                aria-pressed={on}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  on
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-1 ring-inset ring-[var(--accent)]/30'
                    : 'border-[var(--border-default)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-muted)]'
                )}
              >
                <k.Icon className={cn('size-4', on ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]')} />
                <span className="text-[13px] font-medium leading-tight text-[var(--text-primary)]">{k.label}</span>
                <span className="text-[11px] text-[var(--text-quaternary)]">{k.hint}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
          Details <span className="font-normal normal-case tracking-normal">(optional, but better posts)</span>
        </label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={activeKind?.placeholder}
          disabled={busy}
          rows={2}
          maxLength={500}
          className="w-full resize-y rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => generate('post')}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--text-on-accent)] shadow-sm transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading === 'post' ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          Write the post
        </button>
        <button
          type="button"
          onClick={() => generate('ideas')}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading === 'ideas' ? <Loader2 className="size-4 animate-spin" /> : <Lightbulb className="size-4" />}
          Give me 5 ideas
        </button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-[var(--error)]">
          {error}
        </p>
      )}

      {ideas.length > 0 && (
        <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Ideas <span className="text-[var(--text-quaternary)]">— tap one to write it</span>
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {ideas.map((idea, i) => (
              <li key={i}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => generate('post', idea.angle?.trim() ? `${idea.title} — ${idea.angle}` : idea.title)}
                  className="flex h-full w-full flex-col items-start rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] p-3 text-left transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--bg-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="text-sm font-semibold leading-snug text-[var(--text-primary)]">{idea.title}</span>
                  {idea.angle && <span className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{idea.angle}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
