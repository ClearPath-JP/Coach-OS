'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { createProgramSchema } from '@/lib/validations'
import { AssignProgramModal } from '@/components/coach/AssignProgramModal'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'

type Program = {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  status: string
  total_modules: number
  created_at: string
  updated_at: string
  assigned_count?: number
}

type Tab = 'all' | 'draft' | 'published'
type ViewMode = 'grid' | 'list'

function programGradient(title: string): string {
  const c = (title.trim()[0] ?? 'A').toUpperCase()
  if (c >= 'A' && c <= 'E')
    return 'linear-gradient(135deg, var(--cp-accent) 0%, var(--brand-primary, #1565C0) 100%)'
  if (c >= 'F' && c <= 'J') return 'linear-gradient(135deg, #10B981 0%, #065F46 100%)'
  if (c >= 'K' && c <= 'O') return 'linear-gradient(135deg, #8B5CF6 0%, #4C1D95 100%)'
  if (c >= 'P' && c <= 'T') return 'linear-gradient(135deg, #F59E0B 0%, #92400E 100%)'
  return 'linear-gradient(135deg, #F43F5E 0%, #881337 100%)'
}

function previewLetters(title: string): string {
  const t = title.trim()
  if (t.length >= 2) return t.slice(0, 2).toUpperCase()
  return (t.slice(0, 1) || '?').toUpperCase()
}

function ProgramCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--cp-offwhite)]">
      <div className="h-[160px] animate-pulse bg-[var(--bg-muted)]" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--bg-muted)]" />
        <div className="h-3 w-full animate-pulse rounded bg-[var(--bg-muted)]" />
      </div>
    </div>
  )
}

export function ProgramsPageContent() {
  const router = useRouter()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [view, setView] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [assignProgramId, setAssignProgramId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [createTitle, setCreateTitle] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fetchPrograms = useCallback(async () => {
    setError(null)
    try {
      const params = new URLSearchParams()
      if (tab === 'draft') params.set('status', 'draft')
      if (tab === 'published') params.set('status', 'published')
      const res = await fetch(`/api/programs?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load programs')
        setPrograms([])
        return
      }
      setPrograms(json.data ?? [])
    } catch {
      setError('Something went wrong — check your connection and try again')
      setPrograms([])
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    setLoading(true)
    fetchPrograms()
  }, [fetchPrograms])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return programs
    return programs.filter((p) => p.title.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q))
  }, [programs, searchQuery])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    const parsed = createProgramSchema.safeParse({
      title: createTitle.trim(),
      description: createDescription.trim() || null,
    })
    if (!parsed.success) {
      setSubmitError(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error ?? 'Could not create program')
        return
      }
      setCreateOpen(false)
      setCreateTitle('')
      setCreateDescription('')
      router.push(`/coach/programs/${json.data.id}`)
    } catch {
      setSubmitError('Something went wrong — try again')
    } finally {
      setSubmitting(false)
    }
  }

  const archiveProgram = async (id: string) => {
    const res = await fetch(`/api/programs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
      credentials: 'include',
    })
    if (res.ok) fetchPrograms()
    setMenuId(null)
  }

  const deleteProgram = async (id: string, title: string) => {
    if (!window.confirm(`Delete ${title}?`)) return
    const res = await fetch(`/api/programs/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) fetchPrograms()
    setMenuId(null)
  }

  const tabs: { value: Tab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Draft' },
  ]

  return (
    <>
      <PageHeader title="Programs" countLabel={`${programs.length} programs`}>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            placeholder="Search programs…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-[min(100vw-8rem,220px)] max-w-full border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[14px]"
            aria-label="Search programs"
          />
          <div className="flex items-center rounded-[var(--radius-md)] border border-[var(--border-default)] p-0.5">
            <button
              type="button"
              aria-label="List view"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
              className={cn(
                'flex size-8 items-center justify-center rounded-[6px] transition-colors duration-[80ms]',
                view === 'list' ? 'bg-[var(--cp-accent)] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)]'
              )}
            >
              ☰
            </button>
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
              className={cn(
                'flex size-8 items-center justify-center rounded-[6px] transition-colors duration-[80ms]',
                view === 'grid' ? 'bg-[var(--cp-accent)] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)]'
              )}
            >
              ⊞
            </button>
          </div>
          <Button className="min-h-9" onClick={() => setCreateOpen(true)}>
            Create program
          </Button>
        </div>
      </PageHeader>

      <div className="pb-10">

      <div className="mb-6 flex flex-wrap gap-0 border-b border-[var(--border-subtle)]">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              'relative h-9 px-4 text-[14px] transition-colors duration-150',
              tab === t.value
                ? 'font-medium text-[var(--text-primary)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t after:bg-[var(--cp-accent)]'
                : 'font-normal text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {[1, 2, 3].map((i) => (
            <ProgramCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-8 text-center">
          <p className="text-[var(--text-tertiary)]">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={fetchPrograms}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && programs.length === 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-light)] text-xl" aria-hidden>
            📚
          </div>
          <p className="text-xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">Build your signature program</p>
          <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-relaxed text-[var(--text-tertiary)]">
            Create a structured program for your clients with videos, notes, and assignments. Assign it once, use it forever.
          </p>
          <Button className="mt-8" onClick={() => setCreateOpen(true)}>
            Create a program
          </Button>
        </div>
      )}

      {!loading && !error && programs.length > 0 && view === 'grid' && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {filtered.map((prog) => (
            <div
              key={prog.id}
              className="card-interactive group relative flex w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] text-left"
              onClick={() => router.push(`/coach/programs/${prog.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  router.push(`/coach/programs/${prog.id}`)
                }
              }}
              role="link"
              tabIndex={0}
            >
              <div
                className="relative h-[160px] shrink-0 overflow-hidden"
                style={{ background: programGradient(prog.title) }}
              >
                <span
                  className={cn(
                    'absolute right-2 top-2 z-[1] rounded-[8px] px-2 py-0.5 text-[11px] font-semibold',
                    prog.status === 'published'
                      ? 'bg-[var(--cp-offwhite)] text-[var(--cp-accent)]'
                      : 'bg-[var(--cp-offwhite)]/60 text-white'
                  )}
                >
                  {prog.status === 'published' ? 'Published' : 'Draft'}
                </span>
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.35)_0%,transparent_55%)]" />
                <span className="absolute bottom-2 left-2 z-[1] text-[11px] font-semibold text-white drop-shadow-sm">
                  {prog.total_modules} modules
                </span>
                <div className="flex h-full items-center justify-center">
                  <span className="text-[32px] font-bold text-white drop-shadow-sm">{previewLetters(prog.title)}</span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 min-w-0 flex-1 text-[15px] font-semibold leading-snug text-[var(--text-primary)]">{prog.title}</p>
                  <div className="relative shrink-0 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                    <details open={menuId === prog.id} onToggle={(ev) => setMenuId((ev.target as HTMLDetailsElement).open ? prog.id : null)}>
                      <summary className="flex size-6 cursor-pointer list-none items-center justify-center rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)]">
                        ···
                      </summary>
                      <div className="absolute right-0 z-20 mt-1 min-w-[160px] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] py-1 shadow-[var(--shadow-lg)]">
                        <Link
                          href={`/coach/programs/${prog.id}`}
                          className="block px-3 py-2 text-left text-[13px] hover:bg-[var(--bg-muted)]"
                          onClick={() => setMenuId(null)}
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[var(--bg-muted)]"
                          onClick={() => setAssignProgramId(prog.id)}
                        >
                          Assign
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[var(--bg-muted)]"
                          onClick={() => void archiveProgram(prog.id)}
                        >
                          Archive
                        </button>
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[13px] text-[var(--error)] hover:bg-[var(--bg-muted)]"
                          onClick={() => void deleteProgram(prog.id, prog.title)}
                        >
                          Delete
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
                {prog.description?.trim() ? (
                  <p className="mt-1 line-clamp-1 text-[12px] text-[var(--text-tertiary)]">{prog.description}</p>
                ) : null}
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-2.5 text-[13px] text-[var(--text-tertiary)]">
                <span>{prog.assigned_count ?? 0} clients assigned</span>
                <span className="text-[var(--text-quaternary)]">
                  {prog.updated_at ? formatDistanceToNow(new Date(prog.updated_at), { addSuffix: true }) : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && programs.length > 0 && view === 'list' && (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)]">
          <ul className="divide-y divide-[var(--border-subtle)]">
            {filtered.map((prog) => (
              <li key={prog.id}>
                <Link
                  href={`/coach/programs/${prog.id}`}
                  className="flex items-center gap-4 px-4 py-3 transition-colors duration-[80ms] hover:bg-[var(--bg-subtle)]"
                >
                  <div
                    className="size-10 shrink-0 rounded-full text-center text-[11px] font-bold leading-10 text-white"
                    style={{ background: programGradient(prog.title) }}
                  >
                    {previewLetters(prog.title)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--text-primary)]">{prog.title}</p>
                    <p className="text-[12px] text-[var(--text-tertiary)]">
                      {prog.total_modules} modules · {prog.assigned_count ?? 0} clients
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded px-2 py-0.5 text-[11px] font-medium',
                      prog.status === 'published' ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]'
                    )}
                  >
                    {prog.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false)
          setSubmitError(null)
        }}
        title="Create program"
        className="w-full max-w-none md:max-w-md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Title *</label>
            <Input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="e.g. Getting Started" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Description</label>
            <Textarea value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="Optional" rows={3} />
          </div>
          {submitError && <p className="text-sm text-[var(--error)]">{submitError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create program'}
            </Button>
          </div>
        </form>
      </Modal>

      <AssignProgramModal
        programId={assignProgramId ?? ''}
        open={!!assignProgramId}
        onClose={() => setAssignProgramId(null)}
        onAssigned={() => {
          setAssignProgramId(null)
          fetchPrograms()
        }}
      />
      </div>
    </>
  )
}
