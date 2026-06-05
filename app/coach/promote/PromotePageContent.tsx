'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Megaphone, ArrowLeft, RotateCcw, Dumbbell, Bookmark, CheckCircle2, Pencil, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  StepProgress,
  ToneToggle,
  PlatformToggle,
  PostCard,
  VideoPlanCard,
  ResultActions,
  fullCaption,
  videoPlanCaption,
  postTitle,
  savedToResult,
  EMPTY_BRAND_VOICE,
  type Path,
  type Tone,
  type Platform,
  type PromoteResult,
  type BrandVoice,
  type SavedPost,
  type DoneMeta,
} from './promote-shared'
import { PathStep } from './PathStep'
import { IdeaStep } from './IdeaStep'
import { ChatStep } from './ChatStep'
import { VideoStep } from './VideoStep'
import { SavedPosts } from './SavedPosts'
import { Card } from '@/components/ui/Card'

const FORM_KEY = 'kindo-promote-form'
const LEADS_KEY = 'kindo-leads-form'

const VOICE_FIELD_CLS =
  'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20'

export function PromotePageContent() {
  const [view, setView] = useState<'create' | 'saved'>('create')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [path, setPath] = useState<Path | null>(null)
  const [voice, setVoice] = useState<BrandVoice>(EMPTY_BRAND_VOICE)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [result, setResult] = useState<PromoteResult | null>(null)
  const [currentPostId, setCurrentPostId] = useState<string | null>(null)
  const [posted, setPosted] = useState(false)
  const [editing, setEditing] = useState(false)
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [initialVideoId, setInitialVideoId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const brandLoaded = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load brand voice from the workspace profile (fallback to legacy localStorage) ──
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/coach/promote/profile', { credentials: 'include' })
        const json = await res.json().catch(() => ({}))
        if (!cancelled && res.ok && json.data) {
          const d = json.data
          setVoice({
            discipline: d.discipline ?? '',
            tone: (d.tone as Tone) ?? 'friendly',
            platform: (d.platform as Platform) ?? 'instagram',
            bookingUrl: d.booking_url ?? '',
            signature: d.signature ?? '',
          })
          brandLoaded.current = true
          return
        }
      } catch {
        /* fall through to localStorage */
      }
      if (cancelled) return
      try {
        const raw = localStorage.getItem(FORM_KEY)
        if (raw) {
          const v = JSON.parse(raw) as Partial<{ discipline: string; tone: Tone }>
          setVoice((prev) => ({
            ...prev,
            discipline: typeof v.discipline === 'string' ? v.discipline : prev.discipline,
            tone: v.tone === 'hype' || v.tone === 'calm' || v.tone === 'friendly' ? v.tone : prev.tone,
          }))
        } else {
          const lr = localStorage.getItem(LEADS_KEY)
          if (lr) {
            const lv = JSON.parse(lr) as Partial<{ discipline: string }>
            if (typeof lv.discipline === 'string') setVoice((prev) => ({ ...prev, discipline: lv.discipline as string }))
          }
        }
      } catch {
        /* ignore malformed cache */
      }
      brandLoaded.current = true
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const persistVoice = useCallback((v: BrandVoice) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void fetch('/api/coach/promote/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          discipline: v.discipline.trim() || null,
          tone: v.tone,
          platform: v.platform,
          bookingUrl: v.bookingUrl.trim() || null,
          signature: v.signature.trim() || null,
        }),
      }).catch(() => {})
      try {
        localStorage.setItem(FORM_KEY, JSON.stringify({ discipline: v.discipline.trim(), tone: v.tone }))
      } catch {
        /* ignore quota */
      }
    }, 700)
  }, [])

  function updateVoice(patch: Partial<BrandVoice>) {
    setVoice((prev) => {
      const next = { ...prev, ...patch }
      if (brandLoaded.current) persistVoice(next)
      return next
    })
  }

  // ── Deep link: /coach/promote?video=<id> opens the Video path with that clip ──
  useEffect(() => {
    if (typeof window === 'undefined') return
    const vid = new URLSearchParams(window.location.search).get('video')
    if (vid) {
      setInitialVideoId(vid)
      setPath('video')
      setResult(null)
      setStep(2)
      window.history.replaceState({}, '', '/coach/promote')
    }
  }, [])

  const fetchSaved = useCallback(async () => {
    setSavedLoading(true)
    try {
      const res = await fetch('/api/coach/promote/posts', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(json.data)) setSavedPosts(json.data as SavedPost[])
    } catch {
      /* shelf stays empty */
    } finally {
      setSavedLoading(false)
    }
  }, [])

  function openSaved() {
    setView('saved')
    void fetchSaved()
  }

  // ── Result lifecycle: show + auto-save a draft ──
  async function done(r: PromoteResult, meta?: DoneMeta) {
    setResult(r)
    setPosted(false)
    setEditing(false)
    setCurrentPostId(null)
    setSaveError(null)
    setStep(3)
    try {
      const body =
        r.type === 'post'
          ? { type: 'post' as const, content: r.post }
          : { type: 'video' as const, content: r.videoPlan }
      const res = await fetch('/api/coach/promote/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...body,
          path: path ?? 'idea',
          kind: meta?.kind ?? null,
          platform: voice.platform,
          tone: voice.tone,
          title: postTitle(r),
          sourceVideoId: meta?.sourceVideoId ?? null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.data?.id) setCurrentPostId(json.data.id as string)
      else setSaveError('Could not sync to your shelf — your post is still here to copy.')
    } catch {
      setSaveError('Could not sync to your shelf — your post is still here to copy.')
    }
  }

  // ── Inline edit → debounced PATCH of the saved draft ──
  function onEditContent(next: PromoteResult) {
    setResult(next)
    if (!currentPostId) return
    if (editTimer.current) clearTimeout(editTimer.current)
    const content = next.type === 'post' ? next.post : next.videoPlan
    editTimer.current = setTimeout(() => {
      void fetch(`/api/coach/promote/posts/${currentPostId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content, title: postTitle(next) }),
      }).catch(() => {})
    }, 700)
  }

  async function markPosted() {
    setPosted(true)
    if (!currentPostId) return
    await fetch(`/api/coach/promote/posts/${currentPostId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'posted' }),
    }).catch(() => {})
  }

  // ── Saved shelf actions ──
  function openSavedPost(s: SavedPost) {
    setResult(savedToResult(s))
    setCurrentPostId(s.id)
    setPosted(s.status === 'posted')
    setPath(s.path)
    setEditing(false)
    setView('create')
    setStep(3)
  }
  async function markSavedPosted(s: SavedPost) {
    setSavedPosts((prev) =>
      prev.map((p) => (p.id === s.id ? { ...p, status: 'posted', posted_at: new Date().toISOString() } : p))
    )
    await fetch(`/api/coach/promote/posts/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'posted' }),
    }).catch(() => {})
  }
  async function deleteSaved(s: SavedPost) {
    setSavedPosts((prev) => prev.filter((p) => p.id !== s.id))
    if (currentPostId === s.id) setCurrentPostId(null)
    await fetch(`/api/coach/promote/posts/${s.id}`, { method: 'DELETE', credentials: 'include' }).catch(() => {})
  }

  // ── Navigation ──
  function pickPath(p: Path) {
    setPath(p)
    setResult(null)
    setCurrentPostId(null)
    setStep(2)
  }
  function jump(s: 1 | 2 | 3) {
    if (s >= step) return
    setStep(s)
    if (s === 1) {
      setPath(null)
      setResult(null)
      setCurrentPostId(null)
    }
  }
  function restart() {
    setStep(1)
    setPath(null)
    setResult(null)
    setCurrentPostId(null)
    setPosted(false)
    setEditing(false)
    setInitialVideoId(null)
  }

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="flex items-center gap-2 font-display text-[26px] font-medium tracking-tight text-[var(--text-primary)]">
              <Megaphone className="size-6 text-[var(--accent)]" />
              Promote
            </h1>
            <div className="flex items-center gap-3">
              {view === 'create' && <StepProgress current={step} lastLabel="Post" onJump={jump} />}
              <button
                type="button"
                onClick={() => (view === 'saved' ? setView('create') : openSaved())}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]"
              >
                <Bookmark className="size-3.5" />
                {view === 'saved' ? 'Create' : 'Saved posts'}
              </button>
            </div>
          </div>
          {view === 'create' && step === 1 && (
            <p className="text-sm text-[var(--text-tertiary)]">We write it — you post it. Pick how you want to start.</p>
          )}
        </header>

        {view === 'saved' ? (
          <SavedPosts
            posts={savedPosts}
            loading={savedLoading}
            onOpen={openSavedPost}
            onMarkPosted={markSavedPosted}
            onDelete={deleteSaved}
            onBack={() => setView('create')}
          />
        ) : (
          <>
            {step > 1 && (
              <button
                type="button"
                onClick={() => jump((step - 1) as 1 | 2 | 3)}
                className="inline-flex items-center gap-1 text-[13px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
              >
                <ArrowLeft className="size-3.5" />
                Back
              </button>
            )}

            {step === 2 && (
              <VoiceBar voice={voice} onChange={updateVoice} open={voiceOpen} onToggleOpen={() => setVoiceOpen((o) => !o)} />
            )}

            {step === 1 && <PathStep onPick={pickPath} />}
            {step === 2 && path === 'idea' && <IdeaStep voice={voice} onDone={done} />}
            {step === 2 && path === 'chat' && <ChatStep voice={voice} onDone={done} />}
            {step === 2 && path === 'video' && <VideoStep voice={voice} initialVideoId={initialVideoId} onDone={done} />}

            {step === 3 && result && (
              <Card className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[12px] text-[var(--text-tertiary)]">
                    {posted ? (
                      <span className="inline-flex items-center gap-1 font-medium text-[var(--success)]">
                        <CheckCircle2 className="size-3.5" /> Marked as posted
                      </span>
                    ) : currentPostId ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="size-3.5 text-[var(--success)]" /> Saved to your shelf
                      </span>
                    ) : saveError ? (
                      <span className="text-[var(--warning)]">{saveError}</span>
                    ) : (
                      <span>Saving…</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing((e) => !e)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]"
                  >
                    <Pencil className="size-3" /> {editing ? 'Done editing' : 'Edit'}
                  </button>
                </div>

                {result.type === 'post' ? (
                  <PostCard post={result.post} editing={editing} onChange={(post) => onEditContent({ type: 'post', post })} />
                ) : (
                  <VideoPlanCard
                    plan={result.videoPlan}
                    editing={editing}
                    onChange={(videoPlan) => onEditContent({ type: 'video', videoPlan })}
                  />
                )}

                <ResultActions caption={result.type === 'post' ? fullCaption(result.post) : videoPlanCaption(result.videoPlan)} />

                <div className="flex items-center justify-between gap-2">
                  {!posted ? (
                    <button
                      type="button"
                      onClick={() => void markPosted()}
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--success)] transition-opacity hover:opacity-80"
                    >
                      <CheckCircle2 className="size-4" /> Mark as posted
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={restart}
                    className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    <RotateCcw className="size-3.5" />
                    Start over
                  </button>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function VoiceBar({
  voice,
  onChange,
  open,
  onToggleOpen,
}: {
  voice: BrandVoice
  onChange: (patch: Partial<BrandVoice>) => void
  open: boolean
  onToggleOpen: () => void
}) {
  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
            <Dumbbell className="size-3" /> What you coach
          </label>
          <input
            value={voice.discipline}
            onChange={(e) => onChange({ discipline: e.target.value })}
            placeholder="e.g. Brazilian Jiu-Jitsu"
            maxLength={80}
            className="w-[200px] max-w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">Tone</label>
          <ToneToggle value={voice.tone} onChange={(tone) => onChange({ tone })} />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">Posting to</label>
          <PlatformToggle value={voice.platform} onChange={(platform) => onChange({ platform })} />
        </div>
        <button
          type="button"
          onClick={onToggleOpen}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
          aria-expanded={open}
        >
          <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} /> Brand voice
        </button>
      </div>
      {open && (
        <div className="grid gap-3 border-t border-[var(--border-subtle)] pt-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
              Booking / enquiry link
            </label>
            <input
              value={voice.bookingUrl}
              onChange={(e) => onChange({ bookingUrl: e.target.value })}
              placeholder="https://…"
              maxLength={300}
              className={VOICE_FIELD_CLS}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
              Sign-off / handle
            </label>
            <input
              value={voice.signature}
              onChange={(e) => onChange({ signature: e.target.value })}
              placeholder="e.g. — Coach Sam, @samjiujitsu"
              maxLength={200}
              className={VOICE_FIELD_CLS}
            />
          </div>
          <p className="text-[11px] text-[var(--text-quaternary)] sm:col-span-2">
            Saved to your account and woven into every post.
          </p>
        </div>
      )}
    </div>
  )
}
