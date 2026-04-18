'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { VideoPlayer } from '@/components/ui/VideoPlayer'
import { DriveFileBrowser } from '@/components/coach/DriveFileBrowser'
import type { Video } from './types'

type AccessDirect = {
  assignmentId: string
  clientId: string
  firstName: string | null
  lastName: string | null
}

type AccessProgram = {
  contentId: string
  contentTitle: string | null
  moduleId: string
  moduleTitle: string
  programId: string
  programTitle: string
  clientsWithProgramAccess: { clientId: string; firstName: string | null; lastName: string | null }[]
}

type AccessPayload = { direct: AccessDirect[]; inPrograms: AccessProgram[] }

type ClientOption = { id: string; first_name: string | null; last_name: string | null }

function clientLabel(c: { firstName?: string | null; lastName?: string | null; first_name?: string | null; last_name?: string | null }) {
  const a = c.firstName ?? c.first_name
  const b = c.lastName ?? c.last_name
  return [a, b].filter(Boolean).join(' ') || 'Client'
}

export function VideosPageContent() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [playerVideo, setPlayerVideo] = useState<Video | null>(null)
  const [addToProgramVideo, setAddToProgramVideo] = useState<Video | null>(null)
  const [manageVideo, setManageVideo] = useState<Video | null>(null)
  const [deleteVideo, setDeleteVideo] = useState<Video | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [driveImportOpen, setDriveImportOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false)
  const router = useRouter()

  const fetchVideos = useCallback(async () => {
    const res = await fetch('/api/videos')
    const data = await res.json()
    if (res.ok) setVideos(data.data ?? [])
    else setError(data.error ?? 'Could not load videos')
  }, [])

  const uniqueCategories = useMemo(() => {
    const s = new Set<string>()
    for (const v of videos) {
      const c = v.category?.trim()
      if (c) s.add(c)
    }
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [videos])

  const filteredVideos = useMemo(() => {
    if (categoryFilter === 'all') return videos
    if (categoryFilter === '__none__') return videos.filter((v) => !v.category?.trim())
    return videos.filter((v) => (v.category ?? '').trim() === categoryFilter)
  }, [videos, categoryFilter])

  useEffect(() => {
    let mounted = true
    void (async () => {
      setLoading(true)
      try {
        await Promise.all([fetchVideos()])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [fetchVideos])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    queueMicrotask(() => {
      if (q.get('drive_connected') === '1') {
        setToast('Google Drive connected.')
        window.history.replaceState({}, '', '/coach/videos')
      }
      const err = q.get('drive_error')
      if (err) {
        setToast(err === 'access_denied' ? 'Google sign-in was cancelled.' : `Drive connection: ${err}`)
        window.history.replaceState({}, '', '/coach/videos')
      }
    })
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('videos-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'videos' },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const title = row?.title as string
          setVideos((prev) => [row as Video, ...prev])
          if (title) setToast(`Video added: ${title}`)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'videos' },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const id = row?.id as string
          const status = row?.processing_status as string
          const title = row?.title as string
          setVideos((prev) => {
            const idx = prev.findIndex((v) => v.id === id)
            if (idx === -1) return prev
            const next = [...prev]
            next[idx] = { ...next[idx], ...row } as Video
            return next
          })
          if (status === 'ready' && title) setToast(`Updated: ${title}`)
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title="Video library" />
        <div className="flex flex-col items-center justify-center gap-3 py-16" aria-busy>
          <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--border-default)]" />
          <div className="grid w-full max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-[var(--bg-subtle)]" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <PageHeader title="Video library" {...(videos.length > 0 ? { countLabel: `${videos.length} videos` } : {})}>
          <Button type="button" size="sm" onClick={() => setDriveImportOpen(true)}>
            Import from Google Drive
          </Button>
          <Link
            href="/coach/settings"
            className="inline-flex h-8 min-h-8 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-3 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-muted)]"
          >
            Drive settings
          </Link>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="inline-flex h-8 min-h-8 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-3 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-muted)]"
            aria-label="How do I add videos from my phone?"
          >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              How do I add videos from my phone?
            </button>
        </PageHeader>

        {!error && videos.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3">
            <label className="shrink-0 text-[13px] text-[var(--text-tertiary)]" htmlFor="video-cat-filter">
              Category
            </label>
            <select
              id="video-cat-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 min-h-9 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--cp-accent)] focus:shadow-[var(--focus-ring)]"
            >
              <option value="all">All videos</option>
              <option value="__none__">Uncategorized</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant={selectMode ? 'primary' : 'secondary'}
              size="sm"
              className="h-9 min-h-9"
              onClick={() => {
                if (selectMode) exitSelectMode()
                else setSelectMode(true)
              }}
            >
              {selectMode ? 'Done selecting' : 'Select videos'}
            </Button>
            {selectMode && selectedIds.size > 0 && (
              <>
                <span className="text-[13px] text-[var(--text-secondary)]">
                  {selectedIds.size} selected
                </span>
                <Button type="button" size="sm" className="h-9 min-h-9" onClick={() => setBulkCategoryOpen(true)}>
                  Set category
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-9 min-h-9" onClick={() => setSelectedIds(new Set())}>
                  Clear selection
                </Button>
              </>
            )}
          </div>
        )}

        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

        {!error && videos.length === 0 && (
          <div className="empty-state-coach mx-auto max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
            <div className="empty-state-coach__icon text-[28px]" aria-hidden>
              🎬
            </div>
            <p className="empty-state-coach__title">No videos yet</p>
            <p className="empty-state-coach__desc">
              Set your import folder in Settings, put videos in that Drive folder, then click <strong>Import from Google Drive</strong> to add them instantly — no upload to our servers.
            </p>
            <Button variant="secondary" className="empty-state-coach__cta" onClick={() => setInfoOpen(true)}>
              How do I add videos from my phone?
            </Button>
          </div>
        )}

        {!error && videos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVideos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                selectMode={selectMode}
                selected={selectedIds.has(video.id)}
                onToggleSelect={() => toggleSelect(video.id)}
                onPlay={() => setPlayerVideo(video)}
                onRetry={undefined}
                onManage={() => setManageVideo(video)}
                onRequestDelete={() => setDeleteVideo(video)}
                onAddToProgram={() => setAddToProgramVideo(video)}
              />
            ))}
          </div>
        )}

        {!error && videos.length > 0 && filteredVideos.length === 0 && (
          <p className="text-[13px] text-[var(--text-tertiary)]">No videos in this category.</p>
        )}
      </div>

      {toast ? <div className="toast-coach">{toast}</div> : null}

      {infoOpen && (
        <Modal isOpen onClose={() => setInfoOpen(false)} title="How to add videos from your phone" className="w-full max-w-none md:max-w-md">
          <ol className="list-decimal list-inside space-y-3 text-sm text-[var(--color-ink)]">
            <li>Create a folder in Google Drive (or use an existing one).</li>
            <li>
              Open the folder and copy the folder ID from the URL (the long string after{' '}
              <code className="bg-[var(--color-border)] px-1 rounded">/folders/</code>). Go to{' '}
              <Link href="/coach/settings" className="underline">
                Settings
              </Link>
              , paste it in the Google Drive import folder field, and click Save.
            </li>
            <li>
              Open the video library and click <strong>Import from Google Drive</strong>. Select files — they appear as ready immediately (streamed from Drive).
            </li>
          </ol>
          <div className="mt-4">
            <Button variant="ghost" onClick={() => setInfoOpen(false)}>
              Close
            </Button>
          </div>
        </Modal>
      )}

      {playerVideo &&
        playerVideo.processing_status === 'ready' &&
        (Boolean(playerVideo.drive_file_id?.trim()) || Boolean(playerVideo.playback_url?.trim())) && (
        <Modal
          isOpen={!!playerVideo}
          onClose={() => setPlayerVideo(null)}
          title={playerVideo.title}
          className="w-full max-w-none md:w-[min(96vw,1400px)]"
        >
          {playerVideo.playback_url?.trim() ? (
            <video
              src={playerVideo.playback_url}
              controls
              className="w-full max-h-[75vh] rounded-lg bg-black object-contain"
              playsInline
            />
          ) : (
            <VideoPlayer
              videoId={playerVideo.id}
              title={playerVideo.title}
              thumbnailUrl={playerVideo.drive_thumbnail_url ?? playerVideo.thumbnail_url}
              className="max-h-[75vh]"
            />
          )}
          <div className="mt-3 flex gap-4 text-sm text-[var(--color-muted)]">
            {playerVideo.duration_seconds != null && <span>Duration: {formatDuration(playerVideo.duration_seconds)}</span>}
            {playerVideo.file_size_bytes != null && <span>Size: {formatFileSize(playerVideo.file_size_bytes)}</span>}
          </div>
        </Modal>
      )}

      <DriveFileBrowser
        open={driveImportOpen}
        onClose={() => setDriveImportOpen(false)}
        onImported={(n) => {
          setToast(`${n} video${n === 1 ? '' : 's'} imported ✓`)
          void fetchVideos()
          setDriveImportOpen(false)
        }}
      />

      {addToProgramVideo && (
        <AddVideoToProgramModal
          video={addToProgramVideo}
          onClose={() => setAddToProgramVideo(null)}
          onDone={() => {
            setToast('Video added to program')
            fetchVideos()
          }}
          onOpenProgram={(programId) => router.push(`/coach/programs/${programId}`)}
        />
      )}

      {manageVideo && (
        <VideoManageModal
          video={manageVideo}
          categorySuggestions={uniqueCategories}
          onClose={() => setManageVideo(null)}
          onSaved={(row) => {
            setVideos((prev) =>
              prev.map((v) =>
                v.id === row.id
                  ? {
                      ...v,
                      title: row.title,
                      description: row.description,
                      category: row.category ?? null,
                    }
                  : v
              )
            )
            setPlayerVideo((prev) =>
              prev?.id === row.id
                ? { ...prev, title: row.title, description: row.description, category: row.category ?? null }
                : prev
            )
            setToast('Video updated')
          }}
        />
      )}

      {deleteVideo && (
        <DeleteVideoConfirmModal
          video={deleteVideo}
          onClose={() => setDeleteVideo(null)}
          onDeleted={() => {
            setVideos((prev) => prev.filter((v) => v.id !== deleteVideo.id))
            if (playerVideo?.id === deleteVideo.id) setPlayerVideo(null)
            setToast('Video deleted')
          }}
          onError={(msg) => setToast(msg)}
        />
      )}

      {bulkCategoryOpen && (
        <BulkCategoryModal
          count={selectedIds.size}
          suggestions={uniqueCategories}
          onClose={() => setBulkCategoryOpen(false)}
          onApply={async (category) => {
            const ids = [...selectedIds]
            const n = ids.length
            const res = await fetch('/api/videos/bulk-category', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoIds: ids, category }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
              setToast(typeof json.error === 'string' ? json.error : 'Could not update categories')
              return
            }
            await fetchVideos()
            setBulkCategoryOpen(false)
            setSelectedIds(new Set())
            setToast(`Updated ${json.data?.updated ?? n} video${n === 1 ? '' : 's'}`)
          }}
        />
      )}
    </>
  )
}

function BulkCategoryModal({
  count,
  suggestions,
  onClose,
  onApply,
}: {
  count: number
  suggestions: string[]
  onClose: () => void
  onApply: (category: string | null) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <Modal isOpen onClose={onClose} title="Set category" className="w-full max-w-none md:max-w-md">
      <p className="text-sm text-[var(--color-muted)] mb-3">
        Apply a category label to {count} selected video{count === 1 ? '' : 's'}. Leave empty and choose &quot;Clear&quot; to remove categories.
      </p>
      <input
        list="bulk-cat-suggestions"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. Drills, Warm-ups"
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-ink)]"
        maxLength={80}
      />
      <datalist id="bulk-cat-suggestions">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={loading}
          onClick={async () => {
            setLoading(true)
            try {
              await onApply(value.trim() === '' ? null : value.trim())
            } finally {
              setLoading(false)
            }
          }}
        >
          {loading ? 'Saving…' : 'Apply'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={async () => {
            setLoading(true)
            try {
              await onApply(null)
            } finally {
              setLoading(false)
            }
          }}
        >
          Clear category
        </Button>
        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
      </div>
    </Modal>
  )
}

function VideoManageModal({
  video,
  categorySuggestions,
  onClose,
  onSaved,
}: {
  video: Video
  categorySuggestions: string[]
  onClose: () => void
  onSaved: (row: { id: string; title: string; description: string | null; category: string | null }) => void
}) {
  const [title, setTitle] = useState(video.title)
  const [description, setDescription] = useState(video.description ?? '')
  const [category, setCategory] = useState(video.category ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [access, setAccess] = useState<AccessPayload | null>(null)
  const [accessLoading, setAccessLoading] = useState(true)
  const [accessErr, setAccessErr] = useState<string | null>(null)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [grantClientId, setGrantClientId] = useState('')
  const [grantLoading, setGrantLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadAccess = useCallback(async () => {
    setAccessLoading(true)
    setAccessErr(null)
    try {
      const res = await fetch(`/api/videos/${video.id}/access`)
      const json = await res.json()
      if (!res.ok) {
        setAccessErr(typeof json.error === 'string' ? json.error : 'Could not load access')
        setAccess(null)
        return
      }
      setAccess(json.data as AccessPayload)
    } catch {
      setAccessErr('Could not load access')
      setAccess(null)
    } finally {
      setAccessLoading(false)
    }
  }, [video.id])

  useEffect(() => {
    setTitle(video.title)
    setDescription(video.description ?? '')
    setCategory(video.category ?? '')
    setErr(null)
  }, [video.id, video.title, video.description, video.category])

  useEffect(() => {
    loadAccess()
  }, [loadAccess])

  useEffect(() => {
    fetch('/api/clients?status=active')
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json.data)) setClients(json.data)
      })
      .catch((err) => {
        console.error('Load clients for videos failed:', err)
      })
  }, [])

  const save = async () => {
    const t = title.trim()
    if (!t) {
      setErr('Title is required')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: t,
          description: description.trim() === '' ? null : description.trim(),
          category: category.trim() === '' ? null : category.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(typeof data.error === 'string' ? data.error : 'Could not save — try again')
        return
      }
      if (data.data) onSaved(data.data)
      onClose()
    } catch {
      setErr('Could not save — try again')
    } finally {
      setSaving(false)
    }
  }

  const revokeDirect = async (assignmentId: string) => {
    setBusyId(assignmentId)
    try {
      const res = await fetch(`/api/video-assignments/${assignmentId}`, { method: 'DELETE' })
      if (res.ok) await loadAccess()
    } finally {
      setBusyId(null)
    }
  }

  const removeFromProgram = async (contentId: string) => {
    if (!confirm('Remove this video block from the program? Clients will no longer see it in that module.')) return
    setBusyId(contentId)
    try {
      const res = await fetch(`/api/content/${contentId}`, { method: 'DELETE' })
      if (res.ok) await loadAccess()
    } finally {
      setBusyId(null)
    }
  }

  const grantAccess = async () => {
    if (!grantClientId) return
    setGrantLoading(true)
    try {
      const res = await fetch('/api/video-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id, clientId: grantClientId }),
      })
      if (res.ok) {
        setGrantClientId('')
        await loadAccess()
      }
    } finally {
      setGrantLoading(false)
    }
  }

  const directIds = new Set(access?.direct.map((d) => d.clientId) ?? [])
  const grantOptions = clients.filter((c) => !directIds.has(c.id))

  return (
    <Modal isOpen onClose={onClose} title="Manage video" className="w-full max-w-none md:max-w-lg md:max-h-[90vh] md:overflow-y-auto">
      <div className="space-y-4">
        <div>
          <label htmlFor="vm-title" className="block text-sm font-medium text-[var(--color-ink)] mb-1">
            Title
          </label>
          <Input id="vm-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </div>
        <div>
          <label htmlFor="vm-desc" className="block text-sm font-medium text-[var(--color-ink)] mb-1">
            Description
          </label>
          <Textarea
            id="vm-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Optional — shown to clients in programs."
          />
        </div>
        <div>
          <label htmlFor="vm-cat" className="block text-sm font-medium text-[var(--color-ink)] mb-1">
            Category
          </label>
          <input
            id="vm-cat"
            list="vm-cat-list"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Organize in your library (optional)"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-ink)]"
            maxLength={80}
          />
          <datalist id="vm-cat-list">
            {categorySuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        {err && <p className="text-sm text-[var(--color-error)]">{err}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>

        <div className="border-t border-[var(--color-border)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-2">Who has access</h3>
          <p className="text-xs text-[var(--color-muted)] mb-3">
            Direct assignments appear in the client&apos;s video library. Program placements reach clients assigned to that program.
          </p>

          {accessLoading && <p className="text-sm text-[var(--color-muted)]">Loading…</p>}
          {accessErr && <p className="text-sm text-[var(--color-error)]">{accessErr}</p>}

          {!accessLoading && access && (
            <div className="space-y-4">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)] mb-2">Direct to client</p>
                {access.direct.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">No direct assignments.</p>
                ) : (
                  <ul className="space-y-2">
                    {access.direct.map((d) => (
                      <li key={d.assignmentId} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-[var(--color-ink)]">{clientLabel(d)}</span>
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-[36px] text-xs shrink-0"
                          disabled={busyId === d.assignmentId}
                          onClick={() => revokeDirect(d.assignmentId)}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {grantOptions.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-[var(--color-border)] pt-3">
                    <div className="flex-1 min-w-[140px]">
                      <label htmlFor="grant-client" className="sr-only">
                        Grant access to client
                      </label>
                      <select
                        id="grant-client"
                        value={grantClientId}
                        onChange={(e) => setGrantClientId(e.target.value)}
                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
                      >
                        <option value="">Grant to client…</option>
                        {grantOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {clientLabel(c)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button type="button" className="min-h-[40px]" disabled={!grantClientId || grantLoading} onClick={grantAccess}>
                      {grantLoading ? 'Adding…' : 'Grant'}
                    </Button>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)] mb-2">In programs</p>
                {access.inPrograms.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">Not used in any program module yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {access.inPrograms.map((p) => (
                      <li key={p.contentId} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-[var(--color-ink)]">{p.programTitle}</p>
                            <p className="text-[var(--color-muted)] text-xs mt-0.5">
                              Module: {p.moduleTitle}
                              {p.contentTitle ? ` · ${p.contentTitle}` : ''}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            className="min-h-[36px] text-xs shrink-0"
                            disabled={busyId === p.contentId}
                            onClick={() => removeFromProgram(p.contentId)}
                          >
                            Remove from program
                          </Button>
                        </div>
                        {p.clientsWithProgramAccess.length > 0 ? (
                          <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                            <p className="text-xs text-[var(--color-muted)] mb-1">Clients on this program</p>
                            <ul className="flex flex-wrap gap-1.5">
                              {p.clientsWithProgramAccess.map((c) => (
                                <li
                                  key={`${p.contentId}-${c.clientId}`}
                                  className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-ink)]"
                                >
                                  {clientLabel(c)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-[var(--color-muted)]">No clients assigned to this program yet.</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function DeleteVideoConfirmModal({
  video,
  onClose,
  onDeleted,
  onError,
}: {
  video: Video
  onClose: () => void
  onDeleted: () => void
  onError: (msg: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        onDeleted()
        onClose()
      } else {
        onError(typeof data.error === 'string' ? data.error : 'Could not delete video')
      }
    } catch {
      onError('Could not delete video')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal isOpen onClose={() => !deleting && onClose()} title="Delete video?" className="w-full max-w-none md:max-w-md">
      <p className="text-sm text-[var(--color-ink)]">
        This removes <span className="font-medium">&quot;{video.title}&quot;</span> from your library. Clients will no longer see it in programs. This cannot be undone.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete video'}
        </Button>
        <Button variant="ghost" type="button" onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
      </div>
    </Modal>
  )
}

function AddVideoToProgramModal({
  video,
  onClose,
  onDone,
  onOpenProgram,
}: {
  video: Video
  onClose: () => void
  onDone: () => void
  onOpenProgram: (programId: string) => void
}) {
  const [programs, setPrograms] = useState<{ id: string; title: string }[]>([])
  const [programId, setProgramId] = useState<string>('')
  const [modules, setModules] = useState<{ id: string; title: string }[]>([])
  const [moduleId, setModuleId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMods, setLoadingMods] = useState(false)
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/programs')
      .then((r) => r.json())
      .then((data) => {
        if (data.data) setPrograms(data.data)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!programId) {
      setModules([])
      setModuleId('')
      return
    }
    setLoadingMods(true)
    fetch(`/api/programs/${programId}`)
      .then((r) => r.json())
      .then((data) => {
        const mods = (data.data?.modules ?? []) as { id: string; title: string }[]
        setModules(mods)
        setModuleId(mods[0]?.id ?? '')
      })
      .finally(() => setLoadingMods(false))
  }, [programId])

  const add = async () => {
    if (!programId || !moduleId) {
      setMsg('Choose a program and module')
      return
    }
    setAdding(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/programs/${programId}/modules/${moduleId}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: 'video',
          videoId: video.id,
          title: video.title,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(typeof json.error === 'string' ? json.error : 'Could not add video')
        return
      }
      onDone()
      onClose()
    } catch {
      setMsg('Could not add video')
    } finally {
      setAdding(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Add to program" className="w-full max-w-none md:max-w-md">
      <p className="text-sm text-[var(--color-muted)] mb-3">
        Adds <span className="font-medium text-[var(--color-ink)]">&quot;{video.title}&quot;</span> as a video step in a module.
      </p>
      {loading ? (
        <p className="text-sm text-[var(--color-muted)]">Loading programs…</p>
      ) : programs.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No programs yet. Create one first.</p>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">Program</label>
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
            >
              <option value="">Select program</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">Module</label>
            {loadingMods ? (
              <p className="text-sm text-[var(--color-muted)]">Loading modules…</p>
            ) : (
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                disabled={!programId || modules.length === 0}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm disabled:opacity-50"
              >
                {modules.length === 0 ? (
                  <option value="">No modules — add one in the program editor</option>
                ) : (
                  modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-[var(--color-error)]">{msg}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={add} disabled={adding || !programId || !moduleId || modules.length === 0}>
          {adding ? 'Adding…' : 'Add to module'}
        </Button>
        {programId && (
          <Button type="button" variant="secondary" onClick={() => onOpenProgram(programId)}>
            Open program editor
          </Button>
        )}
        <Button variant="ghost" type="button" onClick={onClose} disabled={adding}>
          Cancel
        </Button>
      </div>
    </Modal>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`
  return `${bytes} B`
}

function VideoCard({
  video,
  selectMode,
  selected,
  onToggleSelect,
  onPlay,
  onRetry,
  onManage,
  onRequestDelete,
  onAddToProgram,
}: {
  video: Video
  selectMode: boolean
  selected: boolean
  onToggleSelect: () => void
  onPlay: () => void
  onRetry: undefined | (() => void)
  onManage: () => void
  onRequestDelete: () => void
  onAddToProgram: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const isDrive = Boolean(video.drive_file_id?.trim())
  const isReady = video.processing_status === 'ready'
  const isFailed = video.processing_status === 'failed'
  const isProcessing =
    !isDrive && (video.processing_status === 'processing' || video.processing_status === 'queued')
  const canPlay = isReady && (isDrive || Boolean(video.playback_url?.trim()))

  const startPreview = async () => {
    const el = previewRef.current
    if (!el) return
    try {
      await el.play()
    } catch {
      // Ignore autoplay restrictions
    }
  }

  const stopPreview = () => {
    const el = previewRef.current
    if (!el) return
    el.pause()
    el.currentTime = 0
  }

  return (
    <Card className={`overflow-hidden p-0 ${selected ? 'ring-2 ring-[var(--color-accent)]' : ''}`}>
      <div className="relative aspect-video bg-[var(--color-border)]" onMouseEnter={startPreview} onMouseLeave={stopPreview}>
        {selectMode && (
          <label className="absolute left-2 top-2 z-30 flex cursor-pointer items-center gap-2 rounded-md bg-black/50 px-2 py-1 text-xs text-white">
            <input type="checkbox" checked={selected} onChange={onToggleSelect} className="rounded border-white/40" />
            Select
          </label>
        )}
        {isReady && video.playback_url?.trim() ? (
          <video
            ref={previewRef}
            src={video.playback_url}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
            loop
          />
        ) : video.thumbnail_url && !video.drive_thumbnail_url ? (
          <Image
            src={video.thumbnail_url}
            alt=""
            fill
            loading="lazy"
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 33vw"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <svg className="w-12 h-12 text-[var(--color-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
              <path d="M10 8l6 4-6 4V8z" />
            </svg>
          </div>
        )}
        {canPlay && (
          <button
            type="button"
            onClick={onPlay}
            className="absolute inset-0 flex items-center justify-center bg-[var(--color-ink)]/30 opacity-0 hover:opacity-100 transition-opacity rounded-t-lg z-10"
            aria-label={`Play ${video.title}`}
          >
            <span className="rounded-full bg-white/90 p-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
        <div className="absolute top-2 right-2 z-20">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-[var(--color-muted)] hover:bg-white/20 hover:text-white"
              aria-label="Options"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="6" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="18" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <button type="button" className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] py-1 shadow-lg">
                  <button
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface)]"
                    onClick={() => {
                      onManage()
                      setMenuOpen(false)
                    }}
                  >
                    Manage (title, category, access…)
                  </button>
                  <button
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface)]"
                    onClick={() => {
                      onAddToProgram()
                      setMenuOpen(false)
                    }}
                  >
                    Add to program
                  </button>
                  <button
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm text-[var(--color-error)] hover:bg-[var(--color-error-light)]"
                    onClick={() => {
                      onRequestDelete()
                      setMenuOpen(false)
                    }}
                  >
                    Delete…
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="p-3">
        {video.category?.trim() ? (
          <span className="mb-1 inline-block rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted)]">
            {video.category.trim()}
          </span>
        ) : null}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-[var(--color-ink)] line-clamp-2 min-w-0 flex-1">{video.title}</h3>
          <Button
            type="button"
            variant="secondary"
            className="min-h-[36px] shrink-0 px-3 py-1.5 text-xs"
            onClick={(e) => {
              e.stopPropagation()
              onManage()
            }}
            aria-label={`Edit title: ${video.title}`}
          >
            Edit
          </Button>
        </div>
        {video.description ? <p className="mt-1 text-sm text-[var(--color-muted)] line-clamp-2">{video.description}</p> : null}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted)]">
          {isReady && video.duration_seconds != null && <span>{formatDuration(video.duration_seconds)}</span>}
          {isReady && video.file_size_bytes != null && <span>{formatFileSize(video.file_size_bytes)}</span>}
          {isReady && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Ready</span>
          )}
        </div>
        {isProcessing && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 animate-pulse">
            Processing (legacy pipeline)
          </span>
        )}
        {!isDrive && video.processing_status === 'queued' && (
          <span className="mt-2 inline-block rounded-full bg-[var(--color-muted)]/20 px-2 py-0.5 text-xs font-medium text-[var(--color-muted)]">
            Queued (legacy)
          </span>
        )}
        {isFailed && (
          <div className="mt-2 space-y-1">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[var(--color-error)]/15 px-2 py-0.5 text-xs font-medium text-[var(--color-error)]">
                Failed
              </span>
              {onRetry && (
                <Button variant="secondary" className="min-h-[32px] text-xs" onClick={onRetry}>
                  Retry
                </Button>
              )}
            </div>
            {video.processing_error ? (
              <p className="text-xs text-[var(--color-error)] break-words line-clamp-4" title={video.processing_error}>
                {video.processing_error}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  )
}
