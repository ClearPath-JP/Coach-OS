'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { XP_ACTIONS } from '@/lib/xp-system'
import { cn } from '@/lib/utils'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { VideoPlayer } from '@/components/ui/VideoPlayer'

type VideoDetail = {
  id: string
  title: string
  description: string | null
  processing_status: string
  playback_url: string | null
  thumbnail_url: string | null
  drive_thumbnail_url?: string | null
  drive_file_id?: string | null
  uses_stream_proxy?: boolean
  duration_seconds: number | null
  file_size_bytes: number | null
}

type ContentBlock = {
  id: string
  module_id: string
  content_type: 'text' | 'url' | 'video' | 'file'
  title: string | null
  body: string | null
  url: string | null
  video_id: string | null
  file_url: string | null
  position: number
}

type Module = {
  id: string
  program_id: string
  title: string
  description: string | null
  position: number
  content: ContentBlock[]
  completed: boolean
}

type ProgramDetail = {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  status: string
  total_modules: number
  clientProgramId: string
  modules: Module[]
  progress: { modulesCompleted: number; totalModules: number }
}

export function ClientProgramDetailContent({ programId }: { programId: string }) {
  const [data, setData] = useState<ProgramDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null)
  const [completingModuleId, setCompletingModuleId] = useState<string | null>(null)
  const [showCompletionBanner, setShowCompletionBanner] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [programCompleteBonusXp, setProgramCompleteBonusXp] = useState(0)
  const expandedModuleIdRef = useRef(expandedModuleId)
  expandedModuleIdRef.current = expandedModuleId

  const fetchProgram = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/client/programs/${programId}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load program')
        setData(null)
        return
      }
      setData(json.data)
      const firstIncomplete = json.data?.modules?.find((m: Module) => !m.completed)
      if (firstIncomplete && !expandedModuleIdRef.current) {
        setExpandedModuleId(firstIncomplete.id)
      }
    } catch {
      setError('Something went wrong — check your connection and try again')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    fetchProgram()
  }, [fetchProgram])

  const handleMarkComplete = async (moduleId: string) => {
    setCompletingModuleId(moduleId)
    try {
      const res = await fetch(`/api/progress/${moduleId}/complete`, { method: 'POST' })
      const payload = await res.json().catch(() => ({})) as {
        data?: { completed?: boolean; bonusXp?: number; alreadyCompleted?: boolean }
      }
      if (res.ok && payload?.data?.completed) {
        setProgramCompleteBonusXp(payload.data.bonusXp ?? XP_ACTIONS.PROGRAM_COMPLETE)
        setShowConfetti(true)
        window.setTimeout(() => setShowConfetti(false), 3200)
      }
      if (res.ok) {
        const updated = await fetch(`/api/client/programs/${programId}`).then((r) => r.json())
        if (updated?.data) {
          setData(updated.data)
          const prog = updated.data.progress
          if (prog?.totalModules > 0 && prog.modulesCompleted >= prog.totalModules) {
            setShowCompletionBanner(true)
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setCompletingModuleId(null)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-2/3 rounded bg-[var(--color-border)]" />
        <div className="h-4 w-full rounded bg-[var(--color-border)]" />
        <div className="h-2 w-full rounded bg-[var(--color-border)]" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card className="text-center">
        <p className="text-[var(--color-muted)]">{error ?? 'Program not found'}</p>
        <Link href="/client/programs">
          <Button variant="secondary" className="mt-4">
            Back to programs
          </Button>
        </Link>
      </Card>
    )
  }

  const pct =
    data.progress.totalModules > 0
      ? Math.round((data.progress.modulesCompleted / data.progress.totalModules) * 100)
      : 0
  const allComplete = data.progress.modulesCompleted >= data.progress.totalModules && data.progress.totalModules > 0
  const xpFromModules = data.progress.modulesCompleted * XP_ACTIONS.PROGRAM_MODULE_COMPLETE
  const xpEarnedDisplay = allComplete ? xpFromModules + programCompleteBonusXp : xpFromModules

  const confettiColors = ['#3b9ee8', '#16a34a', '#eab308', '#a855f7', '#f97316', '#ec4899', '#14b8a6', '#ef4444', '#6366f1', '#84cc16']

  return (
    <div className="space-y-6">
      {showConfetti
        ? confettiColors.map((bg, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${10 + i * 10}%`,
                backgroundColor: bg,
                animationDelay: `${i * 0.1}s`,
              }}
              aria-hidden
            />
          ))
        : null}

      <div>
        <h1 className="font-[family-name:var(--font-display)] text-[28px] font-extrabold tracking-[-0.03em] text-[var(--color-ink)]">{data.title}</h1>
        {data.description && (
          <p className="mt-2 text-[15px] text-[var(--color-muted)]">{data.description}</p>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex justify-between font-[family-name:var(--font-display)] text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
          <span>Progress</span>
          <span>
            {data.progress.modulesCompleted} of {data.progress.totalModules} modules · {pct}%
          </span>
        </div>
        <div className="arcade-track h-3">
          <div className="arcade-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {showCompletionBanner && allComplete && (
        <div className="w-full overflow-hidden rounded-[16px] border-[3px] border-[var(--ink)] bg-[var(--belt-yellow)] shadow-[6px_6px_0_var(--ink)]">
          <div className="px-6 py-8 text-center">
            <p className="text-[48px] leading-none" aria-hidden>
              🎉
            </p>
            <p className="mt-4 font-[family-name:var(--font-display)] text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--ink)]">
              You completed {data.title}!
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-[15px] font-bold text-[var(--ink)]/70">
              {data.progress.modulesCompleted} modules completed · {xpEarnedDisplay} XP earned
            </p>
            <div className="mt-6 flex justify-center">
              <Link href="/client/messages">
                <Button variant="primary" className="min-h-11">
                  Message your coach
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {(data.modules ?? []).map((mod, modIdx) => {
          const isExpanded = expandedModuleId === mod.id
          return (
            <div key={mod.id} className="rounded-[16px] border-[3px] border-[var(--ink)] bg-[var(--bg-subtle)] p-5 shadow-[5px_5px_0_var(--ink)]">
              <button
                type="button"
                className="w-full flex items-center gap-3 text-left"
                onClick={() => setExpandedModuleId(isExpanded ? null : mod.id)}
              >
                <span
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-[var(--ink)] font-[family-name:var(--font-display)] font-extrabold shadow-[2px_2px_0_var(--ink)]',
                    mod.completed
                      ? 'bg-[var(--belt-teal)] text-white'
                      : 'bg-[var(--belt-yellow)] text-[var(--ink)]'
                  )}
                  aria-hidden
                >
                  {mod.completed ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span className="text-sm">{modIdx + 1}</span>
                  )}
                </span>
                <span className="flex-1 font-[family-name:var(--font-display)] font-extrabold text-[var(--color-ink)]">{mod.title}</span>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className={cn('shrink-0 transition-transform', isExpanded && 'rotate-180')}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {isExpanded && (
                <div className="mt-4 pt-4 border-t-2 border-[var(--ink)]/15">
                  {mod.description && (
                    <p className="text-sm text-[var(--color-muted)] mb-4">{mod.description}</p>
                  )}
                  <div className="space-y-4">
                    {(mod.content ?? []).map((block) => (
                      <ContentBlockDisplay key={block.id} block={block} />
                    ))}
                  </div>
                  {!mod.completed && (
                    <Button
                      className="mt-4 w-full min-h-[44px]"
                      onClick={() => handleMarkComplete(mod.id)}
                      disabled={!!completingModuleId}
                    >
                      {completingModuleId === mod.id ? 'Marking…' : 'Mark complete'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ClientVideoBlock({ block }: { block: ContentBlock }) {
  const [video, setVideo] = useState<VideoDetail | null>(null)
  const [loading, setLoading] = useState(!!block.video_id)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!block.video_id) return
    let mounted = true
    void (async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/videos/${block.video_id}`)
        const data = await r.json()
        if (!mounted) return
        if (data.data) setVideo(data.data)
        else setError(true)
      } catch {
        if (mounted) setError(true)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [block.video_id])

  if (!block.video_id) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/10 p-4 text-center">
        <p className="text-sm text-[var(--color-muted)]">No video selected</p>
      </div>
    )
  }
  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
        <p className="text-sm text-[var(--color-muted)]">Loading video…</p>
      </div>
    )
  }
  if (error || !video) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/10 p-4 text-center">
        <p className="text-sm text-[var(--color-muted)]">Video unavailable</p>
      </div>
    )
  }
  if (video.processing_status === 'processing' || video.processing_status === 'queued') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
        <p className="text-sm text-amber-800">Video is being processed. Check back soon.</p>
      </div>
    )
  }
  const poster = video.drive_thumbnail_url ?? video.thumbnail_url
  if (video.processing_status === 'ready' || video.drive_file_id) {
    return (
      <ErrorBoundary
        fallback={
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/10 p-4 text-center">
            <p className="text-sm text-[var(--color-muted)]">Video player could not be displayed</p>
            <p className="mt-1 text-[12px] text-[var(--color-muted)]">Try again or refresh the page.</p>
          </div>
        }
      >
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
          {block.title && (
            <p className="bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)]">
              {block.title}
            </p>
          )}
          {video.description ? (
            <p className="border-b border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted)]">
              {video.description}
            </p>
          ) : null}
          <VideoPlayer
            videoId={video.id}
            title={block.title ?? video.title}
            thumbnailUrl={poster}
          />
        </div>
      </ErrorBoundary>
    )
  }
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/10 p-4 text-center">
      <p className="text-sm text-[var(--color-muted)]">Video unavailable</p>
    </div>
  )
}

function ContentBlockDisplay({ block }: { block: ContentBlock }) {
  if (block.content_type === 'text') {
    return (
      <div className="prose prose-sm max-w-none">
        {block.title && <h4 className="font-medium text-[var(--color-ink)]">{block.title}</h4>}
        <div className="text-[15px] text-[var(--color-ink)] whitespace-pre-wrap">
          {block.body || ''}
        </div>
      </div>
    )
  }
  if (block.content_type === 'url') {
    return (
      <a
        href={block.url ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] p-3 hover:bg-[var(--color-surface)]"
      >
        <span className="text-[var(--color-accent)]" aria-hidden>
          🔗
        </span>
        <span className="font-medium text-[var(--color-ink)]">
          {block.title || block.url || 'Link'}
        </span>
      </a>
    )
  }
  if (block.content_type === 'video') {
    return <ClientVideoBlock block={block} />
  }
  if (block.content_type === 'file' && block.file_url) {
    return (
      <a
        href={block.file_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-surface)]"
      >
        <span aria-hidden>📎</span>
        {block.title || 'Download file'}
      </a>
    )
  }
  return null
}
