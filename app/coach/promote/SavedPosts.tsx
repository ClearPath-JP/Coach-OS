'use client'

import { useState } from 'react'
import { ArrowLeft, Loader2, Copy, Check, Trash2, CheckCircle2, FileText, Film } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { fullCaption, videoPlanCaption, type SavedPost, type Post, type VideoPlan } from './promote-shared'

function captionOf(s: SavedPost): string {
  return s.type === 'post' ? fullCaption(s.content as Post) : videoPlanCaption(s.content as VideoPlan)
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

const PLATFORM_LABEL: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook' }

export function SavedPosts({
  posts,
  loading,
  onOpen,
  onMarkPosted,
  onDelete,
  onBack,
}: {
  posts: SavedPost[]
  loading: boolean
  onOpen: (p: SavedPost) => void
  onMarkPosted: (p: SavedPost) => void
  onDelete: (p: SavedPost) => void
  onBack: () => void
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function copy(s: SavedPost) {
    try {
      await navigator.clipboard.writeText(captionOf(s))
      setCopiedId(s.id)
      window.setTimeout(() => setCopiedId((c) => (c === s.id ? null : c)), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-[13px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="size-3.5" />
        Back to create
      </button>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-[var(--text-tertiary)]" aria-busy>
          <Loader2 className="size-4 animate-spin" /> Loading your posts…
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          title="No saved posts yet"
          description="Every post you generate is saved here automatically — come back to copy, tweak, or mark it as posted."
        />
      ) : (
        <ul className="space-y-2">
          {posts.map((s) => {
            const posted = s.status === 'posted'
            return (
              <li key={s.id}>
                <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <button type="button" onClick={() => onOpen(s)} className="group min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      {s.type === 'video' ? (
                        <Film className="size-3.5 shrink-0 text-[var(--accent)]" />
                      ) : (
                        <FileText className="size-3.5 shrink-0 text-[var(--accent)]" />
                      )}
                      <span className="truncate text-[14px] font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)]">
                        {s.title || 'Untitled post'}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--text-tertiary)]">
                      {s.platform && <span>{PLATFORM_LABEL[s.platform] ?? s.platform}</span>}
                      {s.platform && <span aria-hidden>·</span>}
                      <span className={posted ? 'font-medium text-[var(--success)]' : ''}>{posted ? 'Posted' : 'Draft'}</span>
                      <span aria-hidden>·</span>
                      <span>{formatDate(s.created_at)}</span>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => copy(s)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                    >
                      {copiedId === s.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copiedId === s.id ? 'Copied' : 'Copy'}
                    </button>
                    {!posted && (
                      <button
                        type="button"
                        onClick={() => onMarkPosted(s)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--success)]"
                      >
                        <CheckCircle2 className="size-3.5" />
                        Mark posted
                      </button>
                    )}
                    {confirmId === s.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { onDelete(s); setConfirmId(null) }}
                          className="rounded-md px-2 py-1 text-[12px] font-medium text-[var(--error)] hover:bg-[var(--error-bg)]"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="rounded-md px-2 py-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(s.id)}
                        aria-label="Delete post"
                        className="inline-flex items-center rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--error-bg)] hover:text-[var(--error)]"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
