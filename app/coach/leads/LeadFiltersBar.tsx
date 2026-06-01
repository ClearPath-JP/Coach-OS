'use client'

/**
 * Controlled filter + search bar for the Lead Research CRM.
 * Purely presentational — actual filtering happens in the parent.
 */

import { Download, Search } from 'lucide-react'
import { LEAD_STATUSES, type LeadStatus } from '@/lib/leads-interactions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeadFilters {
  type: string        // '' | 'individual' | 'partner' | 'influencer' | 'business'
  platform: string    // '' | 'instagram' | 'website' | ...
  status: string      // '' | LeadStatus
  search: string      // name / handle substring
}

export interface LeadFiltersBarProps {
  type: string
  platform: string
  status: string
  search: string
  onChange: (partial: Partial<LeadFilters>) => void
  onExportAll: () => void
}

// ---------------------------------------------------------------------------
// Option lists
// ---------------------------------------------------------------------------

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'individual', label: 'Individual' },
  { value: 'partner', label: 'Partner' },
  { value: 'influencer', label: 'Influencer' },
  { value: 'business', label: 'Business' },
] as const

const PLATFORM_OPTIONS = [
  { value: '', label: 'All platforms' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'website', label: 'Website' },
  { value: 'other', label: 'Other' },
] as const

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  replied: 'Replied',
  converted: 'Converted',
  not_interested: 'Not interested',
}

// ---------------------------------------------------------------------------
// Shared select style
// ---------------------------------------------------------------------------

const SELECT_CLS =
  'rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-2.5 py-1.5 text-xs ' +
  'text-[var(--text-primary)] outline-none transition-colors ' +
  'focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeadFiltersBar({
  type,
  platform,
  status,
  search,
  onChange,
  onExportAll,
}: LeadFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Lead type */}
      <select
        value={type}
        onChange={(e) => onChange({ type: e.target.value })}
        aria-label="Filter by lead type"
        className={SELECT_CLS}
      >
        {TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Platform */}
      <select
        value={platform}
        onChange={(e) => onChange({ platform: e.target.value })}
        aria-label="Filter by platform"
        className={SELECT_CLS}
      >
        {PLATFORM_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Status */}
      <select
        value={status}
        onChange={(e) => onChange({ status: e.target.value })}
        aria-label="Filter by status"
        className={SELECT_CLS}
      >
        <option value="">All statuses</option>
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>

      {/* Search */}
      <div className="relative flex-1 min-w-[160px]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-[var(--text-quaternary)]" />
        <input
          type="search"
          value={search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Search name or handle…"
          aria-label="Search leads by name or handle"
          className={
            'w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] ' +
            'py-1.5 pl-7 pr-3 text-xs text-[var(--text-primary)] ' +
            'placeholder:text-[var(--text-quaternary)] outline-none transition-colors ' +
            'focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20'
          }
        />
      </div>

      {/* Export all */}
      <button
        type="button"
        onClick={onExportAll}
        className={
          'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] ' +
          'px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors ' +
          'hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]'
        }
      >
        <Download className="size-3" />
        Export all
      </button>
    </div>
  )
}
