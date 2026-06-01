'use client'

/**
 * Shared presentational helpers for the Lead Research CRM.
 * No data fetching — all callbacks are props.
 */

import { AtSign, Building2, Globe, Handshake, Megaphone, User, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeadResult } from '@/lib/lead-research'
import { type LeadStatus, LEAD_STATUSES } from '@/lib/leads-interactions'

// ---------------------------------------------------------------------------
// URL / email sanitisers — exported so drawers and tables can share them.
// Only http/https are allowed; javascript: and data: URIs are rejected.
// ---------------------------------------------------------------------------

/**
 * Validate a URL before putting it in an href. Only http/https are allowed;
 * javascript: and data: URIs are rejected and replaced with '#'.
 */
export function safeUrl(url: string | null | undefined): string {
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
export function safeMailto(email: string | null | undefined): string | null {
  if (!email) return null
  // Simple sanity check — no angle brackets, newlines, or %0A tricks
  if (/[\s<>\n\r]/.test(email)) return null
  return `mailto:${email}`
}

// ---------------------------------------------------------------------------
// MergedLead — the API's combined shape (LeadResult + stored CRM fields)
// ---------------------------------------------------------------------------

export type MergedLead = LeadResult & {
  leadKey: string
  status: LeadStatus
  notes: string | null
  savedClientId: string | null
}

// ---------------------------------------------------------------------------
// PlatformIcon
// Matches CoachLeadsContent's platformIcon() helper exactly:
//   instagram/twitter/tiktok → AtSign
//   facebook/linkedin        → Building2
//   youtube                  → Video
//   everything else          → Globe
// ---------------------------------------------------------------------------

export function PlatformIcon({ platform }: { platform: string }) {
  const cls = 'size-3'
  if (platform === 'instagram' || platform === 'twitter' || platform === 'tiktok')
    return <AtSign className={cls} />
  if (platform === 'facebook' || platform === 'linkedin') return <Building2 className={cls} />
  if (platform === 'youtube') return <Video className={cls} />
  return <Globe className={cls} />
}

// ---------------------------------------------------------------------------
// TypeBadge
// Matches CoachLeadsContent's LEAD_TYPE_META badge style.
//   individual → brass/accent tinted (primary=true in the original)
//   partner    → green tint
//   influencer → amber tint (closer to brass-adjacent)
//   business   → muted (same as the original non-primary style)
// ---------------------------------------------------------------------------

type LeadTypeLiteral = 'individual' | 'partner' | 'influencer' | 'business'

const TYPE_META: Record<
  LeadTypeLiteral,
  { label: string; Icon: typeof User; colorClass: string }
> = {
  individual: {
    label: 'Individual',
    Icon: User,
    colorClass:
      'bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-inset ring-[var(--accent)]/30',
  },
  partner: {
    label: 'Partner',
    Icon: Handshake,
    colorClass:
      'bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20',
  },
  influencer: {
    label: 'Influencer',
    Icon: Megaphone,
    colorClass:
      'bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/20',
  },
  business: {
    label: 'Business',
    Icon: Building2,
    colorClass: 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]',
  },
}

export function TypeBadge({ leadType }: { leadType: string }) {
  const meta = TYPE_META[(leadType as LeadTypeLiteral) ?? 'individual'] ?? TYPE_META.business
  const { Icon, label, colorClass } = meta
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        colorClass
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// StatusDropdown
// Optimistic — parent is responsible for persisting the change.
// Per-status color: new=blue, contacted=amber, replied=green,
//                   converted=brass, not_interested=muted gray.
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  replied: 'Replied',
  converted: 'Converted',
  not_interested: 'Not interested',
}

const STATUS_SELECT_CLASS: Record<LeadStatus, string> = {
  new: 'text-blue-400',
  contacted: 'text-amber-400',
  replied: 'text-emerald-400',
  converted: 'text-[var(--accent)]',
  not_interested: 'text-[var(--text-tertiary)]',
}

export function StatusDropdown({
  value,
  onChange,
  disabled,
}: {
  value: LeadStatus
  onChange: (s: LeadStatus) => void
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as LeadStatus)}
      className={cn(
        'rounded-md border border-[var(--border-default)] bg-[var(--bg-app)] px-2 py-1 text-xs font-medium outline-none transition-colors',
        'focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        STATUS_SELECT_CLASS[value]
      )}
      // Prevent row-click propagation when the user opens the dropdown
      onClick={(e) => e.stopPropagation()}
    >
      {LEAD_STATUSES.map((s) => (
        <option key={s} value={s} className="bg-[#1a1a1a] text-white">
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  )
}
