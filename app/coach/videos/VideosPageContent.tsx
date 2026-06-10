'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/icons/inked'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { VideoPlayer } from '@/components/ui/VideoPlayer'
import { DriveFileBrowser } from '@/components/coach/DriveFileBrowser'
import { VideoUploader } from './VideoUploader'
import { getCategoryColor, CATEGORY_COLORS, type CategoryColorKey } from '@/lib/video-category-colors'
import { isFeatureEnabled } from '@/lib/feature-flags'
import type { Video, VideoCategory } from './types'

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
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false)
  const [categories, setCategories] = useState<VideoCategory[]>([])
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false)
  const [storage, setStorage] = useState<{ videoBytes: number; videoMaxGb: number } | null>(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'duration'>('newest')
  const router = useRouter()

  const fetchVideos = useCallback(async () => {
    const res = await fetch('/api/videos')
    const data = await res.json()
    if (res.ok) setVideos(data.data ?? [])
    else setError(data.error ?? 'Could not load videos')
  }, [])

  const fetchCategories = useCallback(async () => {
    const res = await fetch('/api/video-categories')
    const data = await res.json()
    if (res.ok) setCategories(data.data ?? [])
  }, [])

  const fetchStorage = useCallback(async () => {
    try {
      const res = await fetch('/api/coach/storage', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.data) {
        setStorage({
          videoBytes: Number(json.data.videoBytes ?? 0),
          videoMaxGb: Number(json.data.videoMaxGb ?? 0),
        })
      }
    } catch {
      /* non-fatal — the meter just won't render */
    }
  }, [])

  const categoryMap = useMemo(() => {
    const m = new Map<string, VideoCategory>()
    for (const c of categories) m.set(c.id, c)
    return m
  }, [categories])

  const filteredVideos = useMemo(() => {
    let list =
      categoryFilter === 'all'
        ? videos
        : categoryFilter === '__none__'
          ? videos.filter((v) => !v.category_id)
          : videos.filter((v) => v.category_id === categoryFilter)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((v) => (v.title ?? '').toLowerCase().includes(q))
    const sorted = [...list]
    switch (sortBy) {
      case 'oldest':
        sorted.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
        break
      case 'name':
        sorted.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' }))
        break
      case 'duration':
        sorted.sort((a, b) => (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0))
        break
      default:
        sorted.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    }
    return sorted
  }, [videos, categoryFilter, search, sortBy])

  useEffect(() => {
    let mounted = true
    void (async () => {
      setLoading(true)
      try {
        await Promise.all([fetchVideos(), fetchCategories()])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [fetchVideos])

  useEffect(() => {
    void fetchStorage()
  }, [fetchStorage, videos.length])

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
          if (status === 'ready') {
            // Realtime payloads come straight from Postgres and bypass the
            // /api/videos mapping, so they lack embed_url + signed mp4/thumbnail
            // URLs. Refetch to swap in a playable row instead of a gray HLS <video>.
            void fetchVideos()
            if (title) setToast(`Updated: ${title}`)
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchVideos])

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
        <PageHeader title="Video library" icon={<Icon name="videos" />} />
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
        <PageHeader title="Video library" icon={<Icon name="videos" />} {...(videos.length > 0 ? { countLabel: `${videos.length} videos` } : {})}>
          <VideoUploader onUploaded={() => { void fetchVideos(); void fetchStorage() }} />
          {/* Desktop: secondary actions inline. */}
          <div className="hidden items-center gap-2 sm:flex">
            <Button type="button" size="sm" variant="secondary" onClick={() => setDriveImportOpen(true)}>
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
          </div>
          {/* Mobile: overflow menu so the header never clips. */}
          <div className="relative sm:hidden">
            <button
              type="button"
              onClick={() => setHeaderMenuOpen((o) => !o)}
              aria-label="More options"
              className="inline-flex h-8 min-h-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-2.5 text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-muted)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="5" cy="12" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="19" cy="12" r="1.6" />
              </svg>
            </button>
            {headerMenuOpen && (
              <>
                <button type="button" className="fixed inset-0 z-30" aria-hidden onClick={() => setHeaderMenuOpen(false)} />
                <div className="absolute right-0 top-full z-40 mt-1 w-60 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] py-1 shadow-xl">
                  <button
                    type="button"
                    onClick={() => { setDriveImportOpen(true); setHeaderMenuOpen(false) }}
                    className="block w-full px-3 py-2 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
                  >
                    Import from Google Drive
                  </button>
                  <Link
                    href="/coach/settings"
                    onClick={() => setHeaderMenuOpen(false)}
                    className="block w-full px-3 py-2 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
                  >
                    Drive settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setInfoOpen(true); setHeaderMenuOpen(false) }}
                    className="block w-full px-3 py-2 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
                  >
                    How do I add videos from my phone?
                  </button>
                </div>
              </>
            )}
          </div>
        </PageHeader>

        {storage && storage.videoMaxGb > 0 && (
          <StorageMeter usedBytes={storage.videoBytes} maxGb={storage.videoMaxGb} />
        )}

        {!error && videos.length > 0 && (
          <>
          {/* ── Category Tabs ── */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--border-subtle)] pb-px">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`relative shrink-0 px-3.5 py-2 text-[13px] font-medium transition-colors ${
                categoryFilter === 'all'
                  ? 'text-[var(--accent)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t after:bg-[var(--accent)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              All ({videos.length})
            </button>
            {categories.map((c) => {
              const count = videos.filter((v) => v.category_id === c.id).length
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryFilter(c.id)}
                  className={`relative shrink-0 px-3.5 py-2 text-[13px] font-medium transition-colors ${
                    categoryFilter === c.id
                      ? 'text-[var(--accent)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t after:bg-[var(--accent)]'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {c.name} ({count})
                </button>
              )
            })}
            {categories.length > 0 && videos.filter((v) => !v.category_id).length > 0 && (
              <button
                type="button"
                onClick={() => setCategoryFilter('__none__')}
                className={`relative shrink-0 px-3.5 py-2 text-[13px] font-medium transition-colors ${
                  categoryFilter === '__none__'
                    ? 'text-[var(--accent)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t after:bg-[var(--accent)]'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
              >
                Uncategorized ({videos.filter((v) => !v.category_id).length})
              </button>
            )}
          </div>

          {/* ── Actions Bar ── */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[150px] flex-1 sm:max-w-xs">
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--text-quaternary)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search videos…"
                className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-app)] pl-8 pr-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none transition-colors focus:border-[var(--accent)]"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort videos"
              className="h-9 shrink-0 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-app)] px-2.5 text-[13px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)]"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name A–Z</option>
              <option value="duration">Longest</option>
            </select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 min-h-9 text-[var(--text-tertiary)]"
              onClick={() => setCategoryManagerOpen(true)}
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
              Manage Categories
            </Button>
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
          </>
        )}

        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

        {!error && videos.length === 0 && (
          <EmptyState
            title="No videos yet"
            description={<>Tap <strong>Upload video</strong> above to add your first clip — videos are processed and stored securely, ready to share with clients. You can also import straight from Google Drive.</>}
            action={<Button variant="secondary" onClick={() => setInfoOpen(true)}>How do I add videos from my phone?</Button>}
          />
        )}

        {!error && videos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVideos.map((video) => {
              const cat = video.category_id ? categoryMap.get(video.category_id) : null
              const catColor = cat ? getCategoryColor(cat.color) : null
              return (
              <VideoCard
                key={video.id}
                video={video}
                categoryName={cat?.name ?? null}
                categoryColor={catColor ? { bg: catColor.bg, text: catColor.text, dot: catColor.dot } : null}
                selectMode={selectMode}
                selected={selectedIds.has(video.id)}
                onToggleSelect={() => toggleSelect(video.id)}
                onPlay={() => setPlayerVideo(video)}
                onManage={() => setManageVideo(video)}
                onRequestDelete={() => setDeleteVideo(video)}
                onAddToProgram={() => setAddToProgramVideo(video)}
                onUseInPromote={() => router.push(`/coach/promote?video=${video.id}`)}
              />
              )
            })}
          </div>
        )}

        {!error && videos.length > 0 && filteredVideos.length === 0 && (
          <p className="text-[13px] text-[var(--text-tertiary)]">
            {search.trim() ? `No videos match “${search.trim()}”.` : 'No videos in this category.'}
          </p>
        )}
      </div>

      {toast ? <div className="toast-coach">{toast}</div> : null}

      {categoryManagerOpen && (
        <CategoryManagerModal
          categories={categories}
          onClose={() => setCategoryManagerOpen(false)}
          onUpdate={() => { void fetchCategories(); void fetchVideos() }}
        />
      )}

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
        (Boolean(playerVideo.embed_url) || Boolean(playerVideo.drive_file_id?.trim()) || Boolean(playerVideo.playback_url?.trim())) && (
        <Modal
          isOpen={!!playerVideo}
          onClose={() => setPlayerVideo(null)}
          title={playerVideo.title}
          className="w-full max-w-none md:w-[min(96vw,1400px)]"
        >
          {playerVideo.embed_url ? (
            // Bunny's hosted player — plays HLS in every browser (a native <video>
            // src=.m3u8 only works in Safari, which is why this was gray before).
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
              <iframe
                src={playerVideo.embed_url}
                className="h-full w-full"
                allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;fullscreen;"
                allowFullScreen
                title={playerVideo.title}
              />
            </div>
          ) : playerVideo.playback_url?.trim() ? (
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
          categories={categories}
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
                      category_id: row.category_id ?? null,
                      shared_with_clients: row.shared_with_clients ?? false,
                    }
                  : v
              )
            )
            setPlayerVideo((prev) =>
              prev?.id === row.id
                ? { ...prev, title: row.title, description: row.description, category: row.category ?? null, category_id: row.category_id ?? null, shared_with_clients: row.shared_with_clients ?? false }
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
          suggestions={categories.map((c) => c.name)}
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

function CategoryManagerModal({
  categories,
  onClose,
  onUpdate,
}: {
  categories: VideoCategory[]
  onClose: () => void
  onUpdate: () => void
}) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<CategoryColorKey>('blue')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState<CategoryColorKey>('blue')

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    const res = await fetch('/api/video-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    })
    setSaving(false)
    if (res.ok) {
      setNewName('')
      setNewColor('blue')
      onUpdate()
    }
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    setSaving(true)
    const res = await fetch(`/api/video-categories?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: editName.trim(), color: editColor }),
    })
    setSaving(false)
    if (res.ok) {
      setEditingId(null)
      onUpdate()
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/video-categories?id=${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok) onUpdate()
  }

  return (
    <Modal isOpen onClose={onClose} title="Manage categories" className="w-full max-w-none md:max-w-md">
      <div className="space-y-4">
        {/* Existing categories */}
        {categories.length > 0 && (
          <div className="space-y-1">
            {categories.map((cat) => {
              const c = getCategoryColor(cat.color)
              const isEditing = editingId === cat.id
              if (isEditing) {
                return (
                  <div key={cat.id} className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 flex-1 text-[13px]"
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleUpdate(cat.id) }}
                    />
                    <div className="flex gap-1">
                      {CATEGORY_COLORS.map((pc) => (
                        <button
                          key={pc.key}
                          type="button"
                          onClick={() => setEditColor(pc.key)}
                          className={`size-5 rounded-full border-2 transition-transform ${editColor === pc.key ? 'scale-125 border-[var(--text-primary)]' : 'border-transparent hover:scale-110'}`}
                          style={{ backgroundColor: pc.dot }}
                          aria-label={pc.label}
                        />
                      ))}
                    </div>
                    <Button size="sm" className="h-7 text-[11px]" disabled={saving} onClick={() => void handleUpdate(cat.id)}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                )
              }
              return (
                <div key={cat.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-[var(--bg-muted)]">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: c.dot }} />
                  <span className="flex-1 text-[14px] font-medium text-[var(--text-primary)]">{cat.name}</span>
                  <button
                    type="button"
                    className="rounded p-1 text-[var(--text-tertiary)] opacity-0 hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] group-hover:opacity-100"
                    onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditColor(cat.color as CategoryColorKey) }}
                    aria-label={`Edit ${cat.name}`}
                  >
                    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-[var(--text-tertiary)] opacity-0 hover:bg-[var(--error-bg)] hover:text-[var(--error)] group-hover:opacity-100"
                    onClick={() => void handleDelete(cat.id)}
                    aria-label={`Delete ${cat.name}`}
                  >
                    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {categories.length === 0 && (
          <p className="py-4 text-center text-[13px] text-[var(--text-tertiary)]">No categories yet. Create one below.</p>
        )}

        {/* Create new category */}
        <div className="border-t border-[var(--border-default)] pt-4">
          <p className="mb-2 text-[13px] font-medium text-[var(--text-secondary)]">New category</p>
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Category name"
              className="h-9 flex-1 text-[13px]"
              onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate() }}
            />
            <Button size="sm" className="h-9" disabled={saving || !newName.trim()} onClick={() => void handleCreate()}>
              Add
            </Button>
          </div>
          <div className="mt-2 flex gap-1.5">
            {CATEGORY_COLORS.map((pc) => (
              <button
                key={pc.key}
                type="button"
                onClick={() => setNewColor(pc.key)}
                className={`size-6 rounded-full border-2 transition-all ${newColor === pc.key ? 'scale-110 border-[var(--text-primary)] shadow-sm' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: pc.dot }}
                aria-label={pc.label}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
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
  categories,
  onClose,
  onSaved,
}: {
  video: Video
  categories: VideoCategory[]
  onClose: () => void
  onSaved: (row: {
    id: string
    title: string
    description: string | null
    category: string | null
    category_id: string | null
    shared_with_clients?: boolean | null
  }) => void
}) {
  const [title, setTitle] = useState(video.title)
  const [description, setDescription] = useState(video.description ?? '')
  const [categoryId, setCategoryId] = useState<string>(video.category_id ?? '')
  const [sharedWithClients, setSharedWithClients] = useState<boolean>(video.shared_with_clients ?? false)
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
    setCategoryId(video.category_id ?? '')
    setSharedWithClients(video.shared_with_clients ?? false)
    setErr(null)
  }, [video.id, video.title, video.description, video.category_id, video.shared_with_clients])

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
          category_id: categoryId === '' ? null : categoryId,
          shared_with_clients: sharedWithClients,
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
          <select
            id="vm-cat"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-ink)]"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {categories.length === 0 && (
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              No categories yet — create them with “Manage Categories”.
            </p>
          )}
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 px-3 py-2.5">
          <span>
            <span className="block text-sm font-medium text-[var(--color-ink)]">Share with clients</span>
            <span className="block text-xs text-[var(--color-muted)]">Show this in every client&apos;s Videos tab.</span>
          </span>
          <input
            type="checkbox"
            checked={sharedWithClients}
            onChange={(e) => setSharedWithClients(e.target.checked)}
            className="size-4 shrink-0 accent-[var(--accent)]"
          />
        </label>
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

function StorageMeter({ usedBytes, maxGb }: { usedBytes: number; maxGb: number }) {
  const usedGb = usedBytes / 1_000_000_000
  const pct = maxGb > 0 ? Math.min(100, Math.round((usedGb / maxGb) * 100)) : 0
  const near = pct >= 80
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 py-2.5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium text-[var(--text-secondary)]">Video storage</span>
        <span className={near ? 'font-semibold text-[var(--warning)]' : 'text-[var(--text-tertiary)]'}>
          {usedGb < 0.1 ? usedGb.toFixed(2) : usedGb.toFixed(1)} / {maxGb} GB used
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${usedBytes > 0 ? Math.max(pct, 2) : 0}%`, background: near ? 'var(--warning)' : 'var(--accent)' }}
        />
      </div>
    </div>
  )
}

function VideoCard({
  video,
  categoryName,
  categoryColor,
  selectMode,
  selected,
  onToggleSelect,
  onPlay,
  onManage,
  onRequestDelete,
  onAddToProgram,
  onUseInPromote,
}: {
  video: Video
  categoryName: string | null
  categoryColor: { bg: string; text: string; dot: string } | null
  selectMode: boolean
  selected: boolean
  onToggleSelect: () => void
  onPlay: () => void
  onManage: () => void
  onRequestDelete: () => void
  onAddToProgram: () => void
  onUseInPromote: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const isReady = video.processing_status === 'ready'
  const isFailed = video.processing_status === 'failed'
  const isProcessing = video.processing_status === 'processing' || video.processing_status === 'queued'
  const canPlay = isReady && Boolean(video.embed_url || video.playback_url?.trim() || video.drive_file_id?.trim())
  const posterUrl = video.thumbnail_url?.trim() || video.drive_thumbnail_url?.trim() || null

  return (
    <div
      className={`card-glow group relative overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] transition-all duration-300 ${
        selected ? 'ring-2 ring-[var(--accent)]' : 'hover:shadow-lg hover:-translate-y-1 hover:border-[var(--accent)]'
      }`}
    >
      {/* Thumbnail / Preview */}
      <div
        className="relative aspect-video cursor-pointer bg-neutral-900"
        onClick={canPlay ? onPlay : undefined}
        onMouseEnter={() => { const el = previewRef.current; if (el) void el.play().catch(() => {}) }}
        onMouseLeave={() => { const el = previewRef.current; if (el) { el.pause(); el.currentTime = 0 } }}
      >
        {/* Video preview — MP4 fallback hover-clip, else a real thumbnail, else placeholder.
            (The old <video src={playback_url}> fed an HLS .m3u8 to a native player → gray.) */}
        {isReady && video.mp4_url ? (
          <video
            ref={previewRef}
            src={video.mp4_url}
            poster={posterUrl ?? undefined}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
            loop
          />
        ) : isReady && posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl} alt={video.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--bg-muted)] to-neutral-900">
            <svg className="size-10 text-[var(--text-quaternary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}

        {/* Select checkbox */}
        {selectMode && (
          <label className="absolute left-2.5 top-2.5 z-30 flex cursor-pointer items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
            <input type="checkbox" checked={selected} onChange={onToggleSelect} className="rounded border-white/50 bg-white/20" />
            Select
          </label>
        )}

        {/* Category badge (top-left) */}
        {categoryName && categoryColor && !selectMode && (
          <span className={`absolute left-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm ${categoryColor.bg} ${categoryColor.text}`}>
            <span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: categoryColor.dot }} />
            {categoryName}
          </span>
        )}

        {/* Duration badge (bottom-right, YouTube style) */}
        {isReady && video.duration_seconds != null && video.duration_seconds > 0 && (
          <span className="absolute bottom-2 right-2 z-20 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums backdrop-blur-sm">
            {formatDuration(video.duration_seconds)}
          </span>
        )}

        {/* Play overlay on hover */}
        {canPlay && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="rounded-full bg-white/90 p-3 shadow-lg">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--color-ink)">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </div>
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2">
              <svg className="size-6 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-[11px] font-medium text-white/90">Processing</span>
            </div>
          </div>
        )}

        {/* Failed overlay */}
        {isFailed && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-red-900/40 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-2">
              <svg className="size-6 text-red-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
              <span className="text-[11px] font-medium text-red-200">Processing failed</span>
              {/* No backend retry path exists (the source file only lived in the browser
                  during upload) — recovery is delete via the menu, then re-upload. */}
              <span className="px-3 text-center text-[10px] text-red-200/80">Delete this video from its menu, then upload it again</span>
            </div>
          </div>
        )}

        {/* 3-dot menu */}
        <div className="absolute right-2 top-2 z-20">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o) }}
            className="rounded-lg bg-black/35 p-1.5 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/55 hover:text-white"
            aria-label="Options"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="6" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="18" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <button type="button" className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] py-1 shadow-xl">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
                  onClick={() => { onManage(); setMenuOpen(false) }}
                >
                  <svg className="size-4 text-[var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Manage
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
                  onClick={() => { onAddToProgram(); setMenuOpen(false) }}
                >
                  <svg className="size-4 text-[var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                  Add to program
                </button>
                {/* Hidden while Promote is behind the Coming-Soon flag — don't route into the wall. */}
                {isReady && isFeatureEnabled('promote') && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
                    onClick={() => { onUseInPromote(); setMenuOpen(false) }}
                  >
                    <svg className="size-4 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l15-5v12L3 14v-3z"/><path d="M7 15v3a2 2 0 003.5 1.3"/></svg>
                    Use in Promote
                  </button>
                )}
                <div className="my-1 border-t border-[var(--border-default)]" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--error)] hover:bg-[var(--error-bg)]"
                  onClick={() => { onRequestDelete(); setMenuOpen(false) }}
                >
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="px-3 pb-3 pt-2.5">
        <h3
          className="cursor-pointer truncate text-[14px] font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
          onClick={onManage}
          title={video.title}
        >
          {video.title}
        </h3>
        <div className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)]">
          {video.file_size_bytes != null && <span>{formatFileSize(video.file_size_bytes)}</span>}
          {video.file_size_bytes != null && video.created_at && <span aria-hidden>·</span>}
          {video.created_at && (
            <span>{new Date(video.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          )}
        </div>
      </div>
    </div>
  )
}
