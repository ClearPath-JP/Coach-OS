'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Loader2,
  Trash2,
  AlertCircle,
  Sparkles,
  Dumbbell,
  MapPin,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { type LeadStatus } from '@/lib/leads-interactions'
import { type MergedLead } from './lead-ui'
import { type LeadFilters, LeadFiltersBar } from './LeadFiltersBar'
import { LeadBulkBar } from './LeadBulkBar'
import { LeadsTable } from './LeadsTable'
import { LeadDetailDrawer } from './LeadDetailDrawer'
import { leadsToCsv, type CsvLeadRow } from './leads-csv'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LeadSearch = {
  id: string
  query: string
  status: 'pending' | 'done' | 'failed'
  results: MergedLead[]
  result_count: number
  cost_cents: number
  error_message: string | null
  created_at: string
  completed_at: string | null
}

type LimitInfo = { used: number; max: number; allowed: boolean }

// ---------------------------------------------------------------------------
// Form constants
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Skeleton placeholder for in-progress search
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-[var(--bg-subtle)]">
          <tr className="border-b border-[var(--border-subtle)]">
            {['w-8', 'min-w-[140px]', 'w-20', 'w-24', 'w-32', 'w-16', 'min-w-[160px]', 'w-24', 'w-20'].map(
              (w, i) => (
                <th key={i} className={cn('px-3 py-2.5', w)}>
                  <div className="h-3 animate-pulse rounded bg-[var(--bg-muted)]" />
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-app)]">
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              {Array.from({ length: 9 }).map((__, j) => (
                <td key={j} className="px-3 py-3">
                  <div
                    className="h-3 animate-pulse rounded bg-[var(--bg-muted)]"
                    style={{ width: `${60 + ((i * 3 + j * 7) % 40)}%`, animationDelay: `${i * 80}ms` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sort helper
// ---------------------------------------------------------------------------

function sortLeads(leads: MergedLead[], key: string, dir: 'asc' | 'desc'): MergedLead[] {
  if (!key) return leads
  return [...leads].sort((a, b) => {
    let av: string = ''
    let bv: string = ''
    if (key === 'name') {
      av = a.name.toLowerCase()
      bv = b.name.toLowerCase()
    } else if (key === 'leadType') {
      av = a.leadType ?? 'individual'
      bv = b.leadType ?? 'individual'
    } else if (key === 'platform') {
      av = a.platform
      bv = b.platform
    } else if (key === 'status') {
      av = a.status
      bv = b.status
    }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return dir === 'asc' ? cmp : -cmp
  })
}

// ---------------------------------------------------------------------------
// CSV download helper
// ---------------------------------------------------------------------------

function downloadCsv(leads: MergedLead[], filename = 'leads.csv') {
  const rows: CsvLeadRow[] = leads.map((l) => ({
    name: l.name,
    handle: l.handle,
    leadType: l.leadType ?? 'individual',
    platform: l.platform,
    email: l.email,
    status: l.status,
    reason: l.reason ?? null,
    url: l.url,
  }))
  const csv = leadsToCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CoachLeadsContent() {
  // ---- existing search + history state ----
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

  // ---- history sidebar collapsible ----
  const [historyOpen, setHistoryOpen] = useState(true)

  // ---- CRM table state ----
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<LeadFilters>({
    type: '',
    platform: '',
    status: '',
    search: '',
  })
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: '',
    dir: 'asc',
  })
  const [openLead, setOpenLead] = useState<MergedLead | null>(null)

  // ---- toast/inline message ----
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

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

  // Restore coach's last-used form inputs
  useEffect(() => {
    try {
      const raw = localStorage.getItem('kindo-leads-form')
      if (!raw) return
      const v = JSON.parse(raw) as Partial<{
        discipline: string
        area: string
        radius: string
        idealClients: string[]
        platform: string
      }>
      if (typeof v.discipline === 'string') setDiscipline(v.discipline)
      if (typeof v.area === 'string') setArea(v.area)
      if (typeof v.radius === 'string') setRadius(v.radius)
      if (Array.isArray(v.idealClients)) {
        setIdealClients(v.idealClients.filter((c): c is string => typeof c === 'string'))
      }
      if (typeof v.platform === 'string') setPlatform(v.platform)
    } catch {
      /* ignore malformed cache */
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Search form handlers (unchanged logic)
  // ---------------------------------------------------------------------------

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
    // Clear table state for new search
    setSelected(new Set())
    setFilters({ type: '', platform: '', status: '', search: '' })
    setSort({ key: '', dir: 'asc' })
    setOpenLead(null)
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
      try {
        localStorage.setItem(
          'kindo-leads-form',
          JSON.stringify({ discipline, area, radius, idealClients, platform })
        )
      } catch {
        /* ignore quota/availability errors */
      }
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

  // ---------------------------------------------------------------------------
  // Derived active search
  // ---------------------------------------------------------------------------

  const active = searches.find((s) => s.id === activeSearchId) ?? null
  const planExhausted = limit ? !limit.allowed : false
  const planMissing = limit && limit.max === 0
  const canRun = discipline.trim().length > 1 && area.trim().length > 1

  // ---------------------------------------------------------------------------
  // Optimistic lead updater — updates the lead in the search results list
  // and (if the drawer is open on that lead) in openLead too.
  // ---------------------------------------------------------------------------

  const updateLeadInState = useCallback(
    (leadKey: string, patch: Partial<MergedLead>) => {
      setSearches((prev) =>
        prev.map((s) => ({
          ...s,
          results: s.results.map((l) =>
            l.leadKey === leadKey ? { ...l, ...patch } : l
          ),
        }))
      )
      setOpenLead((prev) => (prev?.leadKey === leadKey ? { ...prev, ...patch } : prev))
    },
    []
  )

  // ---------------------------------------------------------------------------
  // Interaction persistence
  // ---------------------------------------------------------------------------

  const patchInteraction = useCallback(
    async (leadKey: string, body: Partial<{ status: LeadStatus; notes: string; savedClientId: string }>, revert: () => void) => {
      try {
        const res = await fetch('/api/coach/leads/interaction', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ leadKey, ...body }),
        })
        if (!res.ok) {
          revert()
          setError('Could not save change — please try again.')
        }
      } catch {
        revert()
        setError('Network error while saving — change reverted.')
      }
    },
    []
  )

  const onStatusChange = useCallback(
    (lead: MergedLead, status: LeadStatus) => {
      const prev = lead.status
      updateLeadInState(lead.leadKey, { status })
      void patchInteraction(lead.leadKey, { status }, () =>
        updateLeadInState(lead.leadKey, { status: prev })
      )
    },
    [updateLeadInState, patchInteraction]
  )

  const onNotesChange = useCallback(
    (lead: MergedLead, notes: string) => {
      const prev = lead.notes
      updateLeadInState(lead.leadKey, { notes })
      void patchInteraction(lead.leadKey, { notes }, () =>
        updateLeadInState(lead.leadKey, { notes: prev })
      )
    },
    [updateLeadInState, patchInteraction]
  )

  const onSavedClient = useCallback(
    (lead: MergedLead, clientId: string) => {
      const prevClientId = lead.savedClientId
      const prevStatus = lead.status
      updateLeadInState(lead.leadKey, { savedClientId: clientId, status: 'converted' })
      void patchInteraction(
        lead.leadKey,
        { savedClientId: clientId, status: 'converted' },
        () => updateLeadInState(lead.leadKey, { savedClientId: prevClientId, status: prevStatus })
      )
    },
    [updateLeadInState, patchInteraction]
  )

  // ---------------------------------------------------------------------------
  // Drawer close — stable reference so the Escape listener doesn't re-register
  // ---------------------------------------------------------------------------

  const handleCloseDrawer = useCallback(() => setOpenLead(null), [])

  // ---------------------------------------------------------------------------
  // Derived displayed leads (filter + sort)
  // ---------------------------------------------------------------------------

  const displayedLeads = useMemo<MergedLead[]>(() => {
    if (!active || active.status !== 'done') return []
    let leads = [...active.results]

    if (filters.type) {
      leads = leads.filter((l) => (l.leadType ?? 'individual') === filters.type)
    }
    if (filters.platform) {
      leads = leads.filter((l) => l.platform === filters.platform)
    }
    if (filters.status) {
      leads = leads.filter((l) => l.status === filters.status)
    }
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase()
      leads = leads.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.handle ?? '').toLowerCase().includes(q)
      )
    }

    if (sort.key) {
      leads = sortLeads(leads, sort.key, sort.dir)
    }

    return leads
  }, [active, filters, sort])

  // ---------------------------------------------------------------------------
  // Selection handlers
  // ---------------------------------------------------------------------------

  const onToggle = useCallback((leadKey: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(leadKey)) next.delete(leadKey)
      else next.add(leadKey)
      return next
    })
  }, [])

  const onToggleAll = useCallback(() => {
    setSelected((prev) => {
      const allKeys = displayedLeads.map((l) => l.leadKey)
      if (allKeys.length > 0 && allKeys.every((k) => prev.has(k))) {
        return new Set()
      }
      return new Set(allKeys)
    })
  }, [displayedLeads])

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  // ---------------------------------------------------------------------------
  // Sort handler — toggle dir if same key, else reset to asc
  // ---------------------------------------------------------------------------

  const onSort = useCallback((key: string) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }))
  }, [])

  // ---------------------------------------------------------------------------
  // Bulk actions
  // ---------------------------------------------------------------------------

  const onExportCsv = useCallback(() => {
    const selectedLeads = displayedLeads.filter((l) => selected.has(l.leadKey))
    if (selectedLeads.length === 0) return
    downloadCsv(selectedLeads, 'korva-leads-selected.csv')
  }, [displayedLeads, selected])

  const onMarkContacted = useCallback(() => {
    const selectedLeads = displayedLeads.filter((l) => selected.has(l.leadKey))
    selectedLeads.forEach((lead) => {
      if (lead.status !== 'contacted') onStatusChange(lead, 'contacted')
    })
    clearSelection()
  }, [displayedLeads, selected, onStatusChange, clearSelection])

  // Client-side hide only — no per-lead delete API
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set())
  const onDeleteSelected = useCallback(() => {
    setHiddenKeys((prev) => {
      const next = new Set(prev)
      selected.forEach((k) => next.add(k))
      return next
    })
    clearSelection()
  }, [selected, clearSelection])

  const onAddToClients = useCallback(() => {
    setBulkMessage('Open a lead to save it as a client (each needs an email).')
    setTimeout(() => setBulkMessage(null), 4000)
  }, [])

  const onExportAll = useCallback(() => {
    if (displayedLeads.length === 0) return
    downloadCsv(displayedLeads, 'korva-leads-all.csv')
  }, [displayedLeads])

  // Row click — open drawer
  const onRowClick = useCallback((lead: MergedLead) => {
    setOpenLead(lead)
  }, [])

  // LeadsTable expects onSaveToClient — open drawer to that lead (save form is in the drawer)
  const onSaveToClient = useCallback((lead: MergedLead) => {
    setOpenLead(lead)
  }, [])

  // Apply hidden keys to displayed leads
  const visibleLeads = useMemo(
    () => displayedLeads.filter((l) => !hiddenKeys.has(l.leadKey)),
    [displayedLeads, hiddenKeys]
  )

  // Reset hidden keys when switching active search
  useEffect(() => {
    setHiddenKeys(new Set())
    setSelected(new Set())
    setFilters({ type: '', platform: '', status: '', search: '' })
    setSort({ key: '', dir: 'asc' })
  }, [activeSearchId])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* ---- Page header ---- */}
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
              {limit.max === 0 ? (
                <span>Lead Research is a Pro feature — upgrade to search</span>
              ) : (
                <>
                  <span className="font-semibold text-[var(--text-primary)]">{limit.max - limit.used}</span> /{' '}
                  {limit.max} searches left this month
                </>
              )}
            </div>
          )}
        </header>

        {/* ---- Plan-missing alert ---- */}
        {planMissing && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning)]"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Not included in your plan</p>
              <p className="mt-1 text-xs">
                Lead research is a Pro feature. Upgrade to Pro or Scale to find local clients near you.
              </p>
            </div>
          </div>
        )}

        {/* ---- Search form (unchanged) ---- */}
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
              {error}{' '}
              <button
                type="button"
                onClick={() => void load()}
                className="underline hover:no-underline"
              >
                Retry
              </button>
            </p>
          )}
          {planExhausted && !planMissing && (
            <p className="text-xs text-[var(--warning)]">
              You&apos;ve used all {limit?.max} searches this month. Resets on the 1st.
            </p>
          )}
        </form>

        {/* ---- Results + history ---- */}
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          {/* Active results panel */}
          <div className="order-2 lg:order-1 space-y-4">
            {/* No searches yet */}
            {!active && !loadingList && searches.length === 0 && (
              <EmptyState
                title="Find your first leads"
                description="Fill in the boxes above and run a search — we'll scan local Instagram for real people and referral partners you can reach out to. Your past searches will show up here."
              />
            )}

            {active && (
              <div className="space-y-4">
                {/* Search query summary card */}
                <Card padding="default" className="p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-quaternary)]">Query</p>
                  <p className="mt-1 text-sm text-[var(--text-primary)]">{active.query}</p>
                  <p className="mt-2 text-[11px] text-[var(--text-quaternary)]">
                    {formatDistanceToNow(new Date(active.created_at), { addSuffix: true })}
                    {active.status === 'done' && active.result_count > 0 && (
                      <>{' · '}{active.result_count} {active.result_count === 1 ? 'lead' : 'leads'}</>
                    )}
                  </p>
                </Card>

                {/* Pending skeleton */}
                {active.status === 'pending' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                      <Loader2 className="size-4 animate-spin text-[var(--accent)]" />
                      Searching the web…
                    </div>
                    <TableSkeleton />
                  </div>
                )}

                {/* Error state */}
                {active.status === 'failed' && (
                  <div
                    role="alert"
                    className="rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] p-4 text-sm text-[var(--error)]"
                  >
                    {active.error_message ?? 'Search failed. Try rewording your query.'}
                    <button
                      type="button"
                      onClick={() => void load()}
                      className="ml-2 underline hover:no-underline text-xs"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Done — zero results or all filtered out */}
                {active.status === 'done' && visibleLeads.length === 0 && (
                  <EmptyState
                    title={active.results.length === 0 ? 'No results found' : 'No leads in view'}
                    description={
                      active.results.length === 0
                        ? `No usable results for this search. Try a more specific query in ${area || 'your area'}.`
                        : "You've hidden every lead from this search."
                    }
                    action={
                      active.results.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setHiddenKeys(new Set())}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)] transition-colors"
                        >
                          Show all leads
                        </button>
                      ) : undefined
                    }
                  />
                )}

                {/* Done — results table */}
                {active.status === 'done' && visibleLeads.length > 0 && (
                  <div className="space-y-3">
                    {/* Filters bar */}
                    <LeadFiltersBar
                      type={filters.type}
                      platform={filters.platform}
                      status={filters.status}
                      search={filters.search}
                      onChange={(partial) =>
                        setFilters((prev) => ({ ...prev, ...partial }))
                      }
                      onExportAll={onExportAll}
                    />

                    {/* Bulk message toast */}
                    {bulkMessage && (
                      <p
                        role="status"
                        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]"
                      >
                        {bulkMessage}
                      </p>
                    )}

                    {/* Bulk action bar */}
                    {selected.size > 0 && (
                      <LeadBulkBar
                        count={selected.size}
                        onExportCsv={onExportCsv}
                        onMarkContacted={onMarkContacted}
                        onAddToClients={onAddToClients}
                        onDeleteSelected={onDeleteSelected}
                        onClear={clearSelection}
                      />
                    )}

                    {/* Results count */}
                    <p className="text-[11px] text-[var(--text-quaternary)]">
                      {visibleLeads.length}{' '}
                      {visibleLeads.length === 1 ? 'lead' : 'leads'}
                      {filters.type || filters.platform || filters.status || filters.search
                        ? ' matching filters'
                        : ' · best leads first (unsorted)'}
                    </p>

                    {/* Table */}
                    <LeadsTable
                      leads={visibleLeads}
                      selected={selected}
                      sortKey={sort.key}
                      sortDir={sort.dir}
                      onToggle={onToggle}
                      onToggleAll={onToggleAll}
                      onSort={onSort}
                      onRowClick={onRowClick}
                      onStatusChange={onStatusChange}
                      onSaveToClient={onSaveToClient}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* History sidebar — collapsible */}
          <aside className="order-1 lg:order-2">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3">
              {/* Sidebar header with toggle */}
              <div className="flex items-center justify-between px-2 pb-2 pt-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
                  History
                </p>
                <button
                  type="button"
                  onClick={() => setHistoryOpen((v) => !v)}
                  aria-label={historyOpen ? 'Collapse history' : 'Expand history'}
                  className="rounded p-0.5 text-[var(--text-quaternary)] transition-colors hover:text-[var(--text-secondary)]"
                >
                  {historyOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                </button>
              </div>

              {historyOpen && (
                <>
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
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Lead detail drawer */}
      <LeadDetailDrawer
        lead={openLead}
        coachContext={{ discipline, area }}
        onClose={handleCloseDrawer}
        onStatusChange={onStatusChange}
        onNotesChange={onNotesChange}
        onSavedClient={onSavedClient}
      />
    </main>
  )
}
