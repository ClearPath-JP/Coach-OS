'use client'

/**
 * Dense CRM table for lead results.
 * Purely presentational — no data fetching, only callbacks.
 * Mobile (<640 px): each row collapses into a stacked card via CSS.
 */

import { ExternalLink, Mail, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type LeadStatus } from '@/lib/leads-interactions'
import { type MergedLead, PlatformIcon, StatusDropdown, TypeBadge } from './lead-ui'

// ---------------------------------------------------------------------------
// Helpers (mirrors CoachLeadsContent's cleanName + platformLabel)
// ---------------------------------------------------------------------------

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

function platformLabel(p: string): string {
  if (p === 'website') return 'Website'
  return p.charAt(0).toUpperCase() + p.slice(1)
}

/**
 * Validate a URL before putting it in an href. Only http/https are allowed;
 * javascript: and data: URIs are rejected and replaced with '#'.
 * This is defence-in-depth — the API already validates, but data comes from
 * a third-party scraper so we sanitise at the render boundary too.
 */
function safeUrl(url: string | null | undefined): string {
  if (!url) return '#'
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url
  } catch {
    // not a valid URL
  }
  return '#'
}

/**
 * Build a mailto: href. Only allow a bare email address (no header injection).
 * Returns null if the address looks unsafe.
 */
function safeMailto(email: string | null | undefined): string | null {
  if (!email) return null
  // Simple sanity check — no angle brackets, newlines, or %0A tricks
  if (/[\s<>\n\r]/.test(email)) return null
  return `mailto:${email}`
}

// ---------------------------------------------------------------------------
// Sortable column header
// ---------------------------------------------------------------------------

function SortTh({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className,
}: {
  label: string
  sortKey: string
  currentKey: string
  currentDir: 'asc' | 'desc'
  onSort: (key: string) => void
  className?: string
}) {
  const active = currentKey === sortKey
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-quaternary)]',
        'cursor-pointer select-none transition-colors hover:text-[var(--text-secondary)]',
        active && 'text-[var(--accent)]',
        className
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          <span className="text-[8px]">{currentDir === 'asc' ? '▲' : '▼'}</span>
        ) : (
          <span className="text-[8px] opacity-40">▲▼</span>
        )}
      </span>
    </th>
  )
}

// ---------------------------------------------------------------------------
// LeadsTable
// ---------------------------------------------------------------------------

export interface LeadsTableProps {
  leads: MergedLead[]
  selected: Set<string>
  sortKey: string
  sortDir: 'asc' | 'desc'
  onToggle: (leadKey: string) => void
  onToggleAll: () => void
  onSort: (key: string) => void
  onRowClick: (lead: MergedLead) => void
  onStatusChange: (lead: MergedLead, s: LeadStatus) => void
  onSaveToClient: (lead: MergedLead) => void
}

export function LeadsTable({
  leads,
  selected,
  sortKey,
  sortDir,
  onToggle,
  onToggleAll,
  onSort,
  onRowClick,
  onStatusChange,
  onSaveToClient,
}: LeadsTableProps) {
  const allSelected = leads.length > 0 && selected.size === leads.length

  if (leads.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--text-tertiary)]">No leads match your filters.</p>
    )
  }

  return (
    /*
     * Mobile strategy: at <640px the table becomes a flex column of stacked
     * cards using CSS only — no JS branch. Each <tr> is display:flex flex-col
     * wrapped in a card. <th> headers are hidden; each <td> carries a
     * data-label attribute that's shown as a CSS ::before pseudo-element.
     */
    <div className="w-full overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
      <table className="min-w-full border-collapse text-sm leads-table">
        {/* ----------------------------------------------------------------
            THEAD — sticky, hidden at mobile (card layout takes over)
        ---------------------------------------------------------------- */}
        <thead className="sticky top-0 z-10 bg-[var(--bg-subtle)] max-[640px]:hidden">
          <tr className="border-b border-[var(--border-subtle)]">
            {/* Checkbox — select all */}
            <th
              scope="col"
              className="w-8 px-3 py-2.5"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                aria-label="Select all leads"
                checked={allSelected}
                onChange={onToggleAll}
                className="size-3.5 cursor-pointer accent-[var(--accent)]"
              />
            </th>

            <SortTh label="Lead" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={onSort} className="min-w-[140px]" />
            <SortTh label="Type" sortKey="leadType" currentKey={sortKey} currentDir={sortDir} onSort={onSort} />
            <SortTh label="Platform" sortKey="platform" currentKey={sortKey} currentDir={sortDir} onSort={onSort} />
            <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-quaternary)]">
              Email
            </th>
            <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-quaternary)]">
              Socials
            </th>
            <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-quaternary)] min-w-[160px]">
              Why
            </th>
            <SortTh label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={onSort} />
            <th scope="col" className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-quaternary)]">
              Actions
            </th>
          </tr>
        </thead>

        {/* ----------------------------------------------------------------
            TBODY
        ---------------------------------------------------------------- */}
        <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-app)]">
          {leads.map((lead) => {
            const isSelected = selected.has(lead.leadKey)
            const name = cleanName(lead.name, lead.handle)

            return (
              <tr
                key={lead.leadKey}
                onClick={() => onRowClick(lead)}
                className={cn(
                  'group cursor-pointer transition-colors',
                  'hover:bg-[var(--bg-subtle)]',
                  isSelected && 'bg-[var(--accent)]/5',
                  /*
                   * Mobile: each row becomes a stacked card.
                   * The `leads-table` class on <table> drives the @media rule
                   * in globals (we inline it here via Tailwind arbitrary).
                   */
                  'max-[640px]:flex max-[640px]:flex-col max-[640px]:gap-1.5',
                  'max-[640px]:rounded-xl max-[640px]:border max-[640px]:border-[var(--border-subtle)]',
                  'max-[640px]:m-2 max-[640px]:p-3',
                  // reset table-row display at mobile
                  'max-[640px]:table-row-reset'
                )}
              >
                {/* Checkbox */}
                <td
                  data-label=""
                  className="w-8 px-3 py-3 align-top max-[640px]:hidden"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggle(lead.leadKey)
                  }}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${name}`}
                    checked={isSelected}
                    onChange={() => onToggle(lead.leadKey)}
                    className="size-3.5 cursor-pointer accent-[var(--accent)]"
                  />
                </td>

                {/* Lead name + handle */}
                <td data-label="Lead" className="px-3 py-3 align-top max-[640px]:px-0 max-[640px]:py-0">
                  <div className="flex items-start gap-2 max-[640px]:justify-between">
                    {/* mobile: checkbox inline */}
                    <span
                      className="hidden max-[640px]:block mt-0.5"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggle(lead.leadKey)
                      }}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select ${name}`}
                        checked={isSelected}
                        readOnly
                        className="size-3.5 cursor-pointer accent-[var(--accent)]"
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--text-primary)] text-xs leading-snug">{name}</p>
                      {lead.handle && (
                        <p className="truncate text-[11px] text-[var(--text-tertiary)]">{lead.handle}</p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Type badge */}
                <td data-label="Type" className="px-3 py-3 align-top max-[640px]:px-0 max-[640px]:py-0">
                  <span className="max-[640px]:flex max-[640px]:items-center max-[640px]:gap-2">
                    <span className="hidden max-[640px]:inline text-[10px] text-[var(--text-quaternary)] font-semibold uppercase tracking-wide w-16 shrink-0">Type</span>
                    <TypeBadge leadType={lead.leadType} />
                  </span>
                </td>

                {/* Platform icon */}
                <td data-label="Platform" className="px-3 py-3 align-top max-[640px]:px-0 max-[640px]:py-0">
                  <span className="max-[640px]:flex max-[640px]:items-center max-[640px]:gap-2">
                    <span className="hidden max-[640px]:inline text-[10px] text-[var(--text-quaternary)] font-semibold uppercase tracking-wide w-16 shrink-0">Platform</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                      <PlatformIcon platform={lead.platform} />
                      <span className="max-[640px]:inline hidden sm:inline">{platformLabel(lead.platform)}</span>
                    </span>
                  </span>
                </td>

                {/* Email */}
                <td data-label="Email" className="px-3 py-3 align-top max-[640px]:px-0 max-[640px]:py-0">
                  <span className="max-[640px]:flex max-[640px]:items-center max-[640px]:gap-2">
                    <span className="hidden max-[640px]:inline text-[10px] text-[var(--text-quaternary)] font-semibold uppercase tracking-wide w-16 shrink-0">Email</span>
                    {lead.email ? (
                      <a
                        href={safeMailto(lead.email) ?? '#'}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] underline decoration-[var(--border-default)] underline-offset-2 hover:text-[var(--text-primary)] transition-colors"
                      >
                        <Mail className="size-3 shrink-0" />
                        <span className="truncate max-w-[130px]">{lead.email}</span>
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-[11px] text-[var(--text-quaternary)]">—</span>
                        <button
                          type="button"
                          disabled
                          title="Coming soon"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] text-[var(--text-quaternary)] opacity-50 cursor-not-allowed border border-[var(--border-subtle)] rounded px-1.5 py-0.5 leading-none"
                        >
                          Find email
                        </button>
                      </span>
                    )}
                  </span>
                </td>

                {/* Socials — link to the lead's own profile URL */}
                <td data-label="Socials" className="px-3 py-3 align-top max-[640px]:px-0 max-[640px]:py-0">
                  <span className="max-[640px]:flex max-[640px]:items-center max-[640px]:gap-2">
                    <span className="hidden max-[640px]:inline text-[10px] text-[var(--text-quaternary)] font-semibold uppercase tracking-wide w-16 shrink-0">Socials</span>
                    <a
                      href={safeUrl(lead.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title={`${platformLabel(lead.platform)} profile`}
                      className="inline-flex items-center gap-0.5 text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
                    >
                      <PlatformIcon platform={lead.platform} />
                    </a>
                  </span>
                </td>

                {/* Why (reason) */}
                <td data-label="Why" className="px-3 py-3 align-top max-w-[220px] max-[640px]:px-0 max-[640px]:py-0 max-[640px]:max-w-none">
                  <span className="max-[640px]:flex max-[640px]:items-start max-[640px]:gap-2">
                    <span className="hidden max-[640px]:inline text-[10px] text-[var(--text-quaternary)] font-semibold uppercase tracking-wide w-16 shrink-0 mt-0.5">Why</span>
                    {lead.reason ? (
                      <span
                        className="block truncate text-[11px] text-[var(--text-secondary)] max-[640px]:whitespace-normal max-[640px]:line-clamp-2"
                        title={lead.reason}
                      >
                        {lead.reason}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--text-quaternary)]">—</span>
                    )}
                  </span>
                </td>

                {/* Status dropdown */}
                <td
                  data-label="Status"
                  className="px-3 py-3 align-top max-[640px]:px-0 max-[640px]:py-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="max-[640px]:flex max-[640px]:items-center max-[640px]:gap-2">
                    <span className="hidden max-[640px]:inline text-[10px] text-[var(--text-quaternary)] font-semibold uppercase tracking-wide w-16 shrink-0">Status</span>
                    <StatusDropdown
                      value={lead.status}
                      onChange={(s) => onStatusChange(lead, s)}
                    />
                  </span>
                </td>

                {/* Actions */}
                <td
                  data-label="Actions"
                  className="px-3 py-3 align-top text-right max-[640px]:px-0 max-[640px]:py-0 max-[640px]:text-left"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="inline-flex items-center gap-2 max-[640px]:flex">
                    <span className="hidden max-[640px]:inline text-[10px] text-[var(--text-quaternary)] font-semibold uppercase tracking-wide w-16 shrink-0">Actions</span>
                    {/* Open profile */}
                    <a
                      href={safeUrl(lead.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open profile"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)]/10 px-2 py-1 text-[11px] font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
                    >
                      <ExternalLink className="size-3" />
                      <span className="max-[640px]:inline hidden sm:inline">Open</span>
                    </a>
                    {/* Save to clients */}
                    {!lead.savedClientId && (
                      <button
                        type="button"
                        title="Save to clients"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSaveToClient(lead)
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]"
                      >
                        <UserPlus className="size-3" />
                        <span className="max-[640px]:inline hidden sm:inline">Save</span>
                      </button>
                    )}
                    {lead.savedClientId && (
                      <span className="text-[10px] text-emerald-400 font-medium">Saved</span>
                    )}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
