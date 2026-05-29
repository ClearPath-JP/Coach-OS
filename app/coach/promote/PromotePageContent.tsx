'use client'

import { useEffect, useState } from 'react'
import {
  Megaphone,
  Ticket,
  Dumbbell,
  UserPlus,
  Clapperboard,
  Lightbulb,
  Wand2,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Video as VideoIcon,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Kind = 'class' | 'workout' | 'book1on1' | 'bts'
type Tone = 'hype' | 'calm' | 'friendly'
type Mode = 'ideas' | 'post'

type Idea = { title: string; angle: string }
type Post = {
  hook: string
  caption: string
  hashtags: string[]
  cta: string
  videoScript: string[] | null
}

type LibraryVideo = { id: string; title: string }

const KINDS: { key: Kind; label: string; hint: string; Icon: typeof Ticket; placeholder: string }[] = [
  {
    key: 'class',
    label: 'Class / session',
    hint: 'Fill seats',
    Icon: Ticket,
    placeholder: 'e.g. Saturday 9am beginners class — 4 spots left, first one free',
  },
  {
    key: 'workout',
    label: 'Workout / technique',
    hint: 'Show your expertise',
    Icon: Dumbbell,
    placeholder: 'e.g. 3 drills to fix a slow guard retention',
  },
  {
    key: 'book1on1',
    label: 'Book a 1:1',
    hint: 'Drive enquiries',
    Icon: UserPlus,
    placeholder: 'e.g. taking on 2 new private clients this month',
  },
  {
    key: 'bts',
    label: 'Behind the scenes',
    hint: 'Build trust',
    Icon: Clapperboard,
    placeholder: 'e.g. why I started coaching out of my garage',
  },
]

const TONES: { key: Tone; label: string }[] = [
  { key: 'hype', label: 'Hype' },
  { key: 'calm', label: 'Calm' },
  { key: 'friendly', label: 'Friendly' },
]

const FORM_KEY = 'kindo-promote-form'
const LEADS_KEY = 'kindo-leads-form'

export function PromotePageContent() {
  const [kind, setKind] = useState<Kind>('class')
  const [discipline, setDiscipline] = useState('')
  const [tone, setTone] = useState<Tone>('friendly')
  const [topic, setTopic] = useState('')

  const [ideas, setIdeas] = useState<Idea[]>([])
  const [post, setPost] = useState<Post | null>(null)
  const [loadingMode, setLoadingMode] = useState<Mode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const [videos, setVideos] = useState<LibraryVideo[]>([])
  const [pairedVideoId, setPairedVideoId] = useState<string>('')

  const activeKind = KINDS.find((k) => k.key === kind) ?? KINDS[0]
  const pairedVideo = videos.find((v) => v.id === pairedVideoId) ?? null

  // Restore last-used discipline + tone; fall back to whatever the coach typed in Lead research.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FORM_KEY)
      if (raw) {
        const v = JSON.parse(raw) as Partial<{ discipline: string; tone: Tone }>
        if (typeof v.discipline === 'string') setDiscipline(v.discipline)
        if (v.tone === 'hype' || v.tone === 'calm' || v.tone === 'friendly') setTone(v.tone)
      } else {
        const leadsRaw = localStorage.getItem(LEADS_KEY)
        if (leadsRaw) {
          const lv = JSON.parse(leadsRaw) as Partial<{ discipline: string }>
          if (typeof lv.discipline === 'string') setDiscipline(lv.discipline)
        }
      }
    } catch {
      /* ignore malformed cache */
    }
  }, [])

  // Optional: load the coach's ready video library so a post can be paired with a clip.
  useEffect(() => {
    let cancelled = false
    void fetch('/api/videos?status=ready', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { data?: unknown } | null) => {
        if (cancelled || !json || !Array.isArray(json.data)) return
        const rows = json.data
          .map((v): LibraryVideo | null => {
            if (!v || typeof v !== 'object') return null
            const o = v as Record<string, unknown>
            const id = typeof o.id === 'string' ? o.id : null
            const title = typeof o.title === 'string' && o.title.trim() ? o.title.trim() : 'Untitled video'
            return id ? { id, title } : null
          })
          .filter((v): v is LibraryVideo => v !== null)
        setVideos(rows)
      })
      .catch(() => {
        /* video pairing is optional — fail silently */
      })
    return () => {
      cancelled = true
    }
  }, [])

  function persistForm(nextDiscipline: string, nextTone: Tone) {
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify({ discipline: nextDiscipline, tone: nextTone }))
    } catch {
      /* ignore quota/availability errors */
    }
  }

  async function generate(mode: Mode, topicOverride?: string) {
    const useTopic = (topicOverride ?? topic).trim()
    setError(null)
    setLoadingMode(mode)
    persistForm(discipline.trim(), tone)
    try {
      const res = await fetch('/api/coach/promote/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kind,
          discipline: discipline.trim() || undefined,
          topic: useTopic || undefined,
          tone,
          mode,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { mode: 'ideas'; ideas: Idea[] } | { mode: 'post'; post: Post }
        error?: string
      }
      if (!res.ok) {
        setError(json.error ?? 'Could not generate — try again')
        return
      }
      if (json.data?.mode === 'ideas') {
        setIdeas(json.data.ideas)
        setPost(null)
      } else if (json.data?.mode === 'post') {
        setPost(json.data.post)
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoadingMode(null)
    }
  }

  function writeFromIdea(idea: Idea) {
    const t = idea.angle?.trim() ? `${idea.title} — ${idea.angle}` : idea.title
    setTopic(t)
    void generate('post', t)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500)
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  function fullCaption(p: Post): string {
    const tags = p.hashtags.length ? p.hashtags.map((h) => `#${h}`).join(' ') : ''
    return [p.hook, p.caption, p.cta, tags].filter(Boolean).join('\n\n')
  }

  async function copyAndOpen(p: Post, url: string, key: string) {
    await copyText(fullCaption(p), key)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const busy = loadingMode !== null

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header>
          <h1 className="flex items-center gap-2 font-display text-[28px] font-medium tracking-tight text-[var(--text-primary)]">
            <Megaphone className="size-6 text-[var(--accent)]" />
            Promote
          </h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            We write the post — captions, hooks, hashtags, even a Reel script. You copy it and post to Instagram or
            Facebook. No new tools to learn.
          </p>
        </header>

        {/* Studio form */}
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-5 space-y-5">
          {/* 1. What are you promoting? */}
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
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                      on
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-1 ring-inset ring-[var(--accent)]/30'
                        : 'border-[var(--border-default)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-muted)]'
                    )}
                    aria-pressed={on}
                  >
                    <k.Icon className={cn('size-4', on ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]')} />
                    <span className="text-[13px] font-medium leading-tight text-[var(--text-primary)]">{k.label}</span>
                    <span className="text-[11px] text-[var(--text-quaternary)]">{k.hint}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. discipline + tone */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
                <Dumbbell className="size-3.5" /> What do you coach?
              </label>
              <input
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                placeholder="e.g. Brazilian Jiu-Jitsu"
                disabled={busy}
                maxLength={80}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
                Tone
              </label>
              <div className="inline-flex rounded-lg border border-[var(--border-default)] p-0.5">
                {TONES.map((t) => {
                  const on = t.key === tone
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTone(t.key)}
                      disabled={busy}
                      className={cn(
                        'rounded-md px-3.5 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                        on
                          ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      )}
                      aria-pressed={on}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 3. details */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
              Details <span className="font-normal normal-case tracking-normal text-[var(--text-quaternary)]">(optional, but better posts)</span>
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

          {/* 4. optional video pairing */}
          {videos.length > 0 && (
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
                <VideoIcon className="size-3.5" /> Pair with a video{' '}
                <span className="font-normal normal-case tracking-normal text-[var(--text-quaternary)]">(optional — upload this clip when you post)</span>
              </label>
              <select
                value={pairedVideoId}
                onChange={(e) => setPairedVideoId(e.target.value)}
                disabled={busy}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">No video</option>
                {videos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 5. actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => generate('post')}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--text-on-accent)] shadow-sm transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingMode === 'post' ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              Write the post
            </button>
            <button
              type="button"
              onClick={() => generate('ideas')}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingMode === 'ideas' ? <Loader2 className="size-4 animate-spin" /> : <Lightbulb className="size-4" />}
              Give me 5 ideas
            </button>
          </div>

          {error && (
            <p role="alert" className="text-xs text-[var(--error)]">
              {error}
            </p>
          )}
        </div>

        {/* Ideas */}
        {ideas.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
              Post ideas <span className="text-[var(--text-quaternary)]">({ideas.length})</span>
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {ideas.map((idea, i) => (
                <li
                  key={i}
                  className="flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4"
                >
                  <h3 className="text-sm font-semibold leading-snug text-[var(--text-primary)]">{idea.title}</h3>
                  {idea.angle && (
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{idea.angle}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => writeFromIdea(idea)}
                    disabled={busy}
                    className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-md bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Wand2 className="size-3" />
                    Write this post
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Generated post */}
        {post && (
          <section className="space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                Your post
              </h2>
              {pairedVideo && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[11px] text-[var(--text-tertiary)]">
                  <VideoIcon className="size-3" />
                  {pairedVideo.title}
                </span>
              )}
            </div>

            {/* Hook */}
            {post.hook && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">Hook</p>
                <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{post.hook}</p>
              </div>
            )}

            {/* Caption */}
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">Caption</p>
                <CopyBtn
                  onClick={() => copyText(fullCaption(post), 'caption')}
                  copied={copiedKey === 'caption'}
                  label="Copy caption"
                />
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
                {post.caption}
              </p>
            </div>

            {/* CTA */}
            {post.cta && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">Call to action</p>
                <p className="mt-1 text-sm text-[var(--text-primary)]">{post.cta}</p>
              </div>
            )}

            {/* Hashtags */}
            {post.hashtags.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">Hashtags</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {post.hashtags.map((h) => (
                    <span
                      key={h}
                      className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[11px] text-[var(--text-tertiary)]"
                    >
                      #{h}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Video script */}
            {post.videoScript && post.videoScript.length > 0 && (
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
                    Reel / video script
                  </p>
                  <CopyBtn
                    onClick={() => copyText(post.videoScript!.join('\n'), 'script')}
                    copied={copiedKey === 'script'}
                    label="Copy script"
                  />
                </div>
                <ol className="mt-1.5 space-y-1">
                  {post.videoScript.map((line, i) => (
                    <li key={i} className="flex gap-2 text-sm text-[var(--text-secondary)]">
                      <span className="select-none font-semibold text-[var(--accent)]">{i + 1}.</span>
                      {line}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Post actions */}
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-4">
              <button
                type="button"
                onClick={() => copyAndOpen(post, 'https://www.instagram.com/', 'ig')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-on-accent)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                <ExternalLink className="size-3.5" />
                {copiedKey === 'ig' ? 'Copied — opening…' : 'Copy & open Instagram'}
              </button>
              <button
                type="button"
                onClick={() => copyAndOpen(post, 'https://www.facebook.com/', 'fb')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]"
              >
                <ExternalLink className="size-3.5" />
                {copiedKey === 'fb' ? 'Copied — opening…' : 'Copy & open Facebook'}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function CopyBtn({ onClick, copied, label }: { onClick: () => void; copied: boolean; label: string }) {
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
