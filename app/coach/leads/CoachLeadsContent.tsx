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
  Dumbbell,
  MapPin,
  Users,
  User,
  Handshake,
  Megaphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type LeadType = 'individual' | 'partner' | 'influencer' | 'business'

type LeadResult = {
  name: string
  leadType?: LeadType
  reason?: string | null
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

const DISCIPLINE_SUGGESTIONS = [
  'Brazilian Jiu-Jitsu',
  'Boxing',
  'Muay Thai',
  'MMA',
  'Wrestling',
  'Judo',
  'Karate / Taekwondo',
  'Strength & conditioning',
  'Personal training',
  'Weight-loss coaching',
  'CrossFit',
  'Yoga',
] as const

const IDEAL_CLIENT_OPTIONS = [
  'Beginners',
  'Weight loss',
  'Kids / teens',
  'Women',
  'Competitors',
  'Busy professionals',
  'Seniors',
  'Athletes',
] as const

const RADIUS_OPTIONS = ['5 mi', '10 mi', '25 mi', '50 mi', 'Any distance'] as const

const PLATFORM_OPTIONS = ['Any', 'Instagram', 'Facebook', 'TikTok', 'LinkedIn'] as const

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

function followerTier(n: number | null): string | null {
  if (n == null) return null
  if (n >= 100_000) return 'macro'
  if (n >= 10_000) return 'mid'
  if (n >= 1_000) return 'micro'
  return 'nano'
}

/** Strip a trailing "(@handle)" the model sometimes appends to the display name. */
function cleanName(name: string, handle: string | null): string {
  const n = name.trim()
  const m = n.match(/^(.*?)\s*\((@?[^)]+)\)\s*$/)
  if (m) {
    const base = m[1]?.trim() ?? ''
    const paren = m[2] ?? ''
    const inner = paren.replace(/^@/, '').toLowerCase()
    const h = (handle ?? '').replace(/^@/, '').toLowerCase()
    if (paren.startsWith('@') || (h && inner === h)) {
      return base || n
    }
  }
  return n
}

const LEAD_TYPE_META: Record<LeadType, { label: string; Icon: typeof User; primary: boolean }> = {
  individual: { label: 'Individual', Icon: User, primary: true },
  partner: { label: 'Referral partner', Icon: Handshake, primary: false },
  influencer: { label: 'Influencer', Icon: Megaphone, primary: false },
  business: { label: 'Business', Icon: Building2, primary: false },
}

const LEAD_TYPE_ORDER: Record<LeadType, number> = {
  individual: 0,
  partner: 1,
  influencer: 2,
  business: 3,
}

function LeadCard({ r }: { r: LeadResult }) {
  const meta = LEAD_TYPE_META[r.leadType ?? 'individual'] ?? LEAD_TYPE_META.business
  const tier = followerTier(r.followers)
  const name = cleanName(r.name, r.handle ?? null)
  // The Why line already summarizes individuals; the scraped bio is redundant there.
  const showBio = !!r.bio && (r.leadType ?? 'individual') !== 'individual'
  return (
    <li className="group flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4 transition-colors hover:border-[var(--accent)]/30">
      {/* Lead type + platform */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            meta.primary
              ? 'bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-inset ring-[var(--accent)]/30'
              : 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]'
          )}
        >
          <meta.Icon className="size-3" />
          {meta.label}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase text-[var(--text-quaternary)]">
          {platformIcon(r.platform)}
          {platformLabel(r.platform)}
        </span>
      </div>

      {/* Name (wraps) + handle */}
      <h3 className="mt-2 text-sm font-semibold leading-snug text-[var(--text-primary)]">{name}</h3>
      {r.handle && <p className="text-xs text-[var(--text-tertiary)]">{r.handle}</p>}

      {/* Why this lead */}
      {r.reason && (
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--accent)]">Why: </span>
          {r.reason}
        </p>
      )}

      {/* Bio — only where it adds context beyond the Why line */}
      {showBio && (
        <p className="mt-1.5 text-[11px] text-[var(--text-quaternary)] line-clamp-2">{r.bio}</p>
      )}

      {/* Followers + reach tier */}
      {r.followers != null && (
        <p className="mt-1.5 text-[11px] text-[var(--text-quaternary)]">
          {formatFollowers(r.followers)}
          {tier && (
            <span className="ml-1.5 rounded bg-[var(--bg-muted)] px-1.5 py-0.5 uppercase tracking-wide">
              {tier}
            </span>
          )}
        </p>
      )}

      {/* Actions */}
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
  )
}

export function CoachLeadsContent() {
  const [searches, setSearches] = useState<LeadSearch[]>([])
  const [limit, setLimit] = useState<LimitInfo | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [discipline, setDiscipline] = useState('')
  const [area, setArea] = useState('')
  const [radius, setRadius] = useState('25 mi')
  const [idealClients, setIdealClients] = useState<string[]>([])
  const [platform, setPlatform] = useState('Any')
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
    if (!discipline.trim() || !area.trim()) {
      setError('Add what you coach and your area first')
      return
    }
    const who = idealClients.map((c) => c.toLowerCase()).join(', ')
    const loc = area.trim()
    const radiusStr =
      radius && radius !== 'Any distance' ? `within ${radius} of ${loc}` : `in or near ${loc}`
    const platformStr = platform && platform !== 'Any' ? `, with a public ${platform} presence` : ''
    const composedQuery =
      `Find potential ${discipline.trim()} coaching clients${who ? ` (${who})` : ''} located ${radiusStr}${platformStr}. ` +
      `Prioritize real individuals who could become paying clients; include only a few referral partners or local fitness influencers to round out the list.`
    setRunning(true)
    try {
      const res = await fetch('/api/coach/leads/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: composedQuery, discipline, area, radius, idealClients, platform }),
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

  function toggleClient(opt: string) {
    setIdealClients((prev) => (prev.includes(opt) ? prev.filter((c) => c !== opt) : [...prev, opt]))
  }

  const active = searches.find((s) => s.id === activeSearchId) ?? null
  const planExhausted = limit ? !limit.allowed : false
  const planMissing = limit && limit.max === 0
  const canRun = discipline.trim().length > 1 && area.trim().length > 1
  const sortedResults =
    active?.status === 'done'
      ? [...active.results].sort(
          (a, b) =>
            (LEAD_TYPE_ORDER[a.leadType ?? 'individual'] ?? 0) -
            (LEAD_TYPE_ORDER[b.leadType ?? 'individual'] ?? 0)
        )
      : []
  const directLeads = sortedResults.filter(
    (r) => (r.leadType ?? 'individual') === 'individual' || r.leadType === 'influencer'
  )
  const referralPartners = sortedResults.filter(
    (r) => r.leadType === 'partner' || r.leadType === 'business'
  )

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[28px] font-medium tracking-tight text-[var(--text-primary)]">
              Lead research
            </h1>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">
              Fill in a few boxes — we scan local Instagram for real people and partners you can reach out to.
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

        {/* Guided lead-research form */}
        <form
          onSubmit={runSearch}
          className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-5 space-y-4"
        >
          {/* What do you coach? */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
              <Dumbbell className="size-3.5" /> What do you coach?
            </label>
            <input
              list="discipline-suggestions"
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              placeholder="e.g. Brazilian Jiu-Jitsu"
              disabled={running || planMissing || planExhausted}
              maxLength={80}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <datalist id="discipline-suggestions">
              {DISCIPLINE_SUGGESTIONS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>

          {/* Your area + radius */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
                <MapPin className="size-3.5" /> Your area
              </label>
              <input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="City or ZIP — e.g. Marietta, GA"
                disabled={running || planMissing || planExhausted}
                maxLength={80}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
                Within
              </label>
              <select
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                disabled={running || planMissing || planExhausted}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {RADIUS_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ideal client */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
              <Users className="size-3.5" /> Ideal client
              <span className="font-normal normal-case tracking-normal text-[var(--text-quaternary)]">(pick any)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {IDEAL_CLIENT_OPTIONS.map((opt) => {
                const on = idealClients.includes(opt)
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleClient(opt)}
                    disabled={running || planMissing || planExhausted}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      on
                        ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
                        : 'border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40'
                    )}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Platform + submit */}
          <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
                Find them on
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                disabled={running || planMissing || planExhausted}
                className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p === 'Any' ? 'Any platform' : p}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={running || planMissing || planExhausted || !canRun}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--text-on-accent)] shadow-sm transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Researching… (20-45s)
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Find leads
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
                  <div className="space-y-5">
                    <p className="text-[11px] text-[var(--text-quaternary)]">
                      {active.results.length} {active.results.length === 1 ? 'match' : 'matches'} · best leads first
                    </p>

                    {directLeads.length > 0 && (
                      <section className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                          Direct leads{' '}
                          <span className="text-[var(--text-quaternary)]">({directLeads.length})</span>
                        </h4>
                        <ul className="grid gap-3 sm:grid-cols-2">
                          {directLeads.map((r, i) => (
                            <LeadCard key={`${active.id}-d-${i}`} r={r} />
                          ))}
                        </ul>
                      </section>
                    )}

                    {referralPartners.length > 0 && (
                      <section className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                          Referral partners &amp; businesses{' '}
                          <span className="text-[var(--text-quaternary)]">({referralPartners.length})</span>
                        </h4>
                        <ul className="grid gap-3 sm:grid-cols-2">
                          {referralPartners.map((r, i) => (
                            <LeadCard key={`${active.id}-p-${i}`} r={r} />
                          ))}
                        </ul>
                      </section>
                    )}
                  </div>
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
                    <li key={s.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => setActiveSearchId(s.id)}
                        className={cn(
                          'flex w-full items-start gap-2 rounded-lg py-2 pl-2 pr-8 text-left transition-colors',
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
                            {s.status === 'done' && ` · ${s.result_count} leads`}
                            {s.status === 'pending' && ' · running…'}
                            {s.status === 'failed' && ' · failed'}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteSearch(s.id)}
                        className="absolute right-1.5 top-1.5 rounded p-1 text-[var(--text-quaternary)] opacity-0 transition-opacity hover:text-[var(--error)] focus-visible:opacity-100 group-hover:opacity-100"
                        aria-label="Delete search"
                      >
                        <Trash2 className="size-3.5" />
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
