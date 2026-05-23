'use client'

import { useCallback, useEffect, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Search,
  Loader2,
  ExternalLink,
  Mail,
  Trash2,
  AlertCircle,
  Sparkles,
  Globe,
  AtSign,
  Building2,
  Video,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type LeadResult = {
  name: string
  platform: 'instagram' | 'website' | 'facebook' | 'linkedin' | 'twitter' | 'tiktok' | 'youtube' | 'other'
  handle: string | null
  url: string
  email: string | null
  bio: string | null
  followers: number | null
}

type LeadSearch = {
  id: string
  query: string
  status: 'pending' | 'done' | 'failed'
  results: LeadResult[]
  result_count: number
  cost_cents: number
  error_message: string | null
  created_at: string
  completed_at: string | null
}

type LimitInfo = { used: number; max: number; allowed: boolean }

const EXAMPLE_QUERIES = [
  'Fitness influencers in Atlanta with 5K-50K Instagram followers',
  'Yoga studios in Marietta GA with public Instagram',
  'Personal trainers in 30326 zip code',
  "Women's health coaches in metro Atlanta",
  'Brazilian Jiu-Jitsu academies in Kennesaw GA',
] as const

function platformIcon(p: LeadResult['platform']) {
  const cls = 'size-3'
  if (p === 'instagram' || p === 'twitter' || p === 'tiktok') return <AtSign className={cls} />
  if (p === 'facebook' || p === 'linkedin') return <Building2 className={cls} />
  if (p === 'youtube') return <Video className={cls} />
  return <Globe className={cls} />
}

function platformLabel(p: LeadResult['platform']): string {
  if (p === 'website') return 'Website'
  return p.charAt(0).toUpperCase() + p.slice(1)
}

function formatFollowers(n: number | null): string | null {
  if (n == null) return null
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M followers`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K followers`
  return `${n} followers`
}

export function CoachLeadsContent() {
  const [searches, setSearches] = useState<LeadSearch[]>([])
  const [limit, setLimit] = useState<LimitInfo | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [query, setQuery] = useState('')
  const [running, setRunning] = useState(false)
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await fetch('/api/coach/leads', { credentials: 'include' })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { searches: LeadSearch[]; limit: LimitInfo }
        error?: string
      }
      if (!res.ok) {
        setError(json.error ?? 'Could not load past searches')
        return
      }
      setSearches(json.data?.searches ?? [])
      setLimit(json.data?.limit ?? null)
      if (!activeSearchId && json.data?.searches?.[0]) {
        setActiveSearchId(json.data.searches[0].id)
      }
    } finally {
      setLoadingList(false)
    }
  }, [activeSearchId])

  useEffect(() => {
    void load()
  }, [load])

  async function runSearch(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (query.trim().length < 5) {
      setError('Query must be at least 5 characters')
      return
    }
    setRunning(true)
    try {
      const res = await fetch('/api/coach/leads/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: query.trim() }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { search: LeadSearch; limit: LimitInfo }
        error?: string
        used?: number
        max?: number
      }
      if (!res.ok) {
        setError(json.error ?? 'Search failed')
        return
      }
      const newSearch = json.data?.search
      if (newSearch) {
        setSearches((prev) => [newSearch, ...prev.filter((s) => s.id !== newSearch.id)])
        setActiveSearchId(newSearch.id)
        setQuery('')
      }
      if (json.data?.limit) setLimit(json.data.limit)
    } catch {
      setError('Network error — please try again')
    } finally {
      setRunning(false)
    }
  }

  async function deleteSearch(id: string) {
    if (!window.confirm('Delete this search? The results will be lost.')) return
    const res = await fetch(`/api/coach/leads/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setSearches((prev) => prev.filter((s) => s.id !== id))
      if (activeSearchId === id) {
        const next = searches.find((s) => s.id !== id)
        setActiveSearchId(next?.id ?? null)
      }
    }
  }

  const active = searches.find((s) => s.id === activeSearchId) ?? null
  const planExhausted = limit ? !limit.allowed : false
  const planMissing = limit && limit.max === 0

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[28px] font-medium tracking-tight text-[var(--text-primary)]">
              Lead research
            </h1>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">
              Describe who you want to find. Claude searches the public web and returns profiles you can DM directly.
            </p>
          </div>
          {limit && (
            <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs text-[var(--text-tertiary)]">
              <span className="font-semibold text-[var(--text-primary)]">{limit.max - limit.used}</span> /{' '}
              {limit.max} searches left this month
            </div>
          )}
        </header>

        {planMissing && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning)]"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Not included in your plan</p>
              <p className="mt-1 text-xs">
                Lead research is available on Starter (5/mo), Pro (20/mo), and Scale (50/mo).
              </p>
            </div>
          </div>
        )}

        {/* Search form */}
        <form
          onSubmit={runSearch}
          className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-5 space-y-3"
        >
          <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
            What are you looking for?
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Personal trainers in Atlanta with 5K-50K Instagram followers"
            disabled={running || planMissing || planExhausted}
            rows={3}
            className="w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-60"
            maxLength={500}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_QUERIES.slice(0, 3).map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setQuery(ex)}
                  disabled={running}
                  className="text-[11px] text-[var(--text-tertiary)] underline decoration-dotted underline-offset-2 hover:text-[var(--accent)] disabled:opacity-50"
                >
                  {ex}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={running || planMissing || planExhausted || query.trim().length < 5}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Researching… (10-30s)
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Run search
                </>
              )}
            </button>
          </div>

          {error && (
            <p role="alert" className="text-xs text-[var(--error)]">
              {error}
            </p>
          )}
          {planExhausted && !planMissing && (
            <p className="text-xs text-[var(--warning)]">
              You&apos;ve used all {limit?.max} searches this month. Resets on the 1st.
            </p>
          )}
        </form>

        {/* Results + history */}
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          {/* Active results */}
          <div className="order-2 lg:order-1">
            {!active && !loadingList && searches.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] p-10 text-center">
                <Search className="mx-auto mb-3 size-5 text-[var(--text-tertiary)]" />
                <p className="text-sm text-[var(--text-tertiary)]">
                  Your past searches show here. Run your first one above.
                </p>
              </div>
            )}

            {active && (
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
                    Query
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-primary)]">{active.query}</p>
                  <p className="mt-2 text-[11px] text-[var(--text-quaternary)]">
                    {formatDistanceToNow(new Date(active.created_at), { addSuffix: true })}
                    {active.cost_cents > 0 && (
                      <>
                        {' · '}~${(active.cost_cents / 100).toFixed(2)} compute
                      </>
                    )}
                  </p>
                </div>

                {active.status === 'pending' && (
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-10 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin text-[var(--accent)]" />
                    <p className="mt-3 text-sm text-[var(--text-tertiary)]">Searching the web…</p>
                  </div>
                )}

                {active.status === 'failed' && (
                  <div
                    role="alert"
                    className="rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] p-4 text-sm text-[var(--error)]"
                  >
                    {active.error_message ?? 'Search failed. Try rewording your query.'}
                  </div>
                )}

                {active.status === 'done' && active.results.length === 0 && (
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-10 text-center">
                    <p className="text-sm text-[var(--text-tertiary)]">
                      No usable results. Try a more specific query.
                    </p>
                  </div>
                )}

                {active.status === 'done' && active.results.length > 0 && (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {active.results.map((r, i) => (
                      <li
                        key={`${active.id}-${i}`}
                        className="group rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4 transition-colors hover:border-[var(--accent)]/30"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                              {r.name}
                            </h3>
                            {r.handle && (
                              <p className="text-xs text-[var(--text-tertiary)]">{r.handle}</p>
                            )}
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[10px] font-medium uppercase text-[var(--text-tertiary)]">
                            {platformIcon(r.platform)}
                            {platformLabel(r.platform)}
                          </span>
                        </div>

                        {r.bio && (
                          <p className="mt-2 text-xs text-[var(--text-tertiary)] line-clamp-2">
                            {r.bio}
                          </p>
                        )}

                        {r.followers != null && (
                          <p className="mt-1.5 text-[11px] text-[var(--text-quaternary)]">
                            {formatFollowers(r.followers)}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
                          >
                            <ExternalLink className="size-3" />
                            Open profile
                          </a>
                          {r.email && (
                            <a
                              href={`mailto:${r.email}`}
                              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                            >
                              <Mail className="size-3" />
                              {r.email}
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* History sidebar */}
          <aside className="order-1 lg:order-2">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3">
              <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
                History
              </p>
              {loadingList ? (
                <div className="p-4 text-center">
                  <Loader2 className="mx-auto size-4 animate-spin text-[var(--text-tertiary)]" />
                </div>
              ) : searches.length === 0 ? (
                <p className="px-2 pb-2 text-xs text-[var(--text-tertiary)]">No past searches yet.</p>
              ) : (
                <ul className="space-y-0.5">
                  {searches.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setActiveSearchId(s.id)}
                        className={cn(
                          'group flex w-full items-start justify-between gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                          activeSearchId === s.id
                            ? 'bg-[var(--accent)]/10'
                            : 'hover:bg-[var(--bg-muted)]'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'truncate text-xs',
                              activeSearchId === s.id
                                ? 'font-medium text-[var(--text-primary)]'
                                : 'text-[var(--text-secondary)]'
                            )}
                          >
                            {s.query}
                          </p>
                          <p className="mt-0.5 text-[10px] text-[var(--text-quaternary)]">
                            {format(new Date(s.created_at), 'MMM d, h:mm a')}
                            {s.status === 'done' && ` · ${s.result_count} found`}
                            {s.status === 'pending' && ' · running…'}
                            {s.status === 'failed' && ' · failed'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void deleteSearch(s.id)
                          }}
                          className="shrink-0 text-[var(--text-quaternary)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--error)]"
                          aria-label="Delete search"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
