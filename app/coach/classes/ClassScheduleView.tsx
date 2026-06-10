'use client'

import { useEffect, useState } from 'react'
import { Pencil, Trash2, Users, BookOpen } from 'lucide-react'
import { formatCents } from '@/lib/format-currency'
import type { ClassRecord } from './ClassFormModal'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEEKDAYS = [
  { value: 0, short: 'Mon', long: 'Monday' },
  { value: 1, short: 'Tue', long: 'Tuesday' },
  { value: 2, short: 'Wed', long: 'Wednesday' },
  { value: 3, short: 'Thu', long: 'Thursday' },
  { value: 4, short: 'Fri', long: 'Friday' },
  { value: 5, short: 'Sat', long: 'Saturday' },
  { value: 6, short: 'Sun', long: 'Sunday' },
] as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RosterEntry {
  name: string
  photoUrl: string | null
}

interface BookingCounts {
  /** number of paid bookings for the next occurrence */
  booked: number
  roster: RosterEntry[]
}

export interface ClassScheduleViewProps {
  classes: ClassRecord[]
  onEdit: (cls: ClassRecord) => void
  onDelete: (cls: ClassRecord) => void
  onOpenBookings: (cls: ClassRecord, nextDate: string) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeLabel(t: string): string {
  const [h, m] = t.split(':').map((x) => parseInt(x, 10))
  if (h == null) return t
  const d = new Date(2000, 0, 1, h, m ?? 0)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

/** "HH:MM" + minutes → "HH:MM" (24h, clamped to same day). */
function addMinutes(t: string, mins: number): string {
  const [h, m] = t.split(':').map((x) => parseInt(x, 10))
  const total = (h ?? 0) * 60 + (m ?? 0) + mins
  const eh = Math.floor(total / 60) % 24
  const em = total % 60
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
}

/**
 * Compute the next upcoming occurrence date (YYYY-MM-DD) for a class.
 * - Recurring: soonest future weekday from cls.days[] (Mon=0..Sun=6).
 * - One-time: cls.oneTimeDate directly.
 * Uses today's local date as the baseline; if a day matches today it counts.
 */
export function nextOccurrence(cls: ClassRecord): string | null {
  if (!cls.recurring) {
    return cls.oneTimeDate ?? null
  }
  if (!cls.days || cls.days.length === 0) return null

  // Build a reference date at midnight local
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // JS: 0=Sun 1=Mon…6=Sat; our convention: 0=Mon…6=Sun
  // Convert today's JS dow to our convention
  const jsDow = today.getDay() // 0=Sun..6=Sat
  const ourDow = (jsDow + 6) % 7 // 0=Mon..6=Sun

  let earliest: Date | null = null
  for (const d of cls.days) {
    // How many days ahead is this weekday?
    let diff = d - ourDow
    if (diff < 0) diff += 7
    const candidate = new Date(today)
    candidate.setDate(today.getDate() + diff)
    if (earliest === null || candidate < earliest) {
      earliest = candidate
    }
  }

  if (!earliest) return null
  const yyyy = earliest.getFullYear()
  const mm = String(earliest.getMonth() + 1).padStart(2, '0')
  const dd = String(earliest.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Format YYYY-MM-DD as "Jun 14" */
function fmtDate(dateStr: string): string {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number)
  if (!yyyy || !mm || !dd) return dateStr
  const d = new Date(yyyy, mm - 1, dd)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Initials from a name string (max 2 chars). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return (parts[0]?.[0] ?? '').toUpperCase()
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

/** Consistent deterministic hue from a string, for avatar fallback colors. */
function avatarHue(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return Math.abs(hash) % 360
}

// ---------------------------------------------------------------------------
// Avatar component
// ---------------------------------------------------------------------------

/**
 * Validate a hex color string (#rrggbb or #rgb). Returns null if invalid so
 * it cannot be used to inject arbitrary CSS values.
 */
function safeHexColor(color: string | null | undefined): string | null {
  if (!color) return null
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(color) ? color : null
}

/** Only allow https:// or data: URLs for avatars — reject anything else. */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'data:'
  } catch {
    return false
  }
}

function Avatar({ name, photoUrl, size = 24 }: { name: string; photoUrl: string | null; size?: number }) {
  const hue = avatarHue(name)
  const safePhoto = photoUrl && isSafeUrl(photoUrl) ? photoUrl : null
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--ink)] text-[10px] font-bold text-white"
      style={{
        width: size,
        height: size,
        background: safePhoto ? undefined : `hsl(${hue} 55% 40%)`,
      }}
      title={name}
    >
      {safePhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={safePhoto} alt={name} width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Individual class card
// ---------------------------------------------------------------------------

interface ClassCardProps {
  cls: ClassRecord
  nextDate: string | null
  onEdit: (cls: ClassRecord) => void
  onDelete: (cls: ClassRecord) => void
  onOpenBookings: (cls: ClassRecord, nextDate: string) => void
}

function ClassCard({ cls, nextDate, onEdit, onDelete, onOpenBookings }: ClassCardProps) {
  const [bookings, setBookings] = useState<BookingCounts | null>(null)

  // Best-effort fetch of booked counts for the next occurrence
  useEffect(() => {
    if (!nextDate) return
    let cancelled = false
    const url = `/api/coach/classes/${cls.classGroupId}/bookings?date=${nextDate}`
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: unknown) => {
        if (cancelled) return
        // Validate shape before trusting the response
        const raw =
          json !== null &&
          typeof json === 'object' &&
          'data' in json &&
          json.data !== null &&
          typeof json.data === 'object' &&
          'roster' in json.data &&
          Array.isArray((json.data as Record<string, unknown>).roster)
            ? ((json.data as Record<string, unknown>).roster as unknown[])
            : []
        const roster: RosterEntry[] = raw
          .filter((r): r is Record<string, unknown> => r !== null && typeof r === 'object')
          .map((r) => ({
            name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'Client',
            photoUrl: typeof r.photoUrl === 'string' ? r.photoUrl : null,
          }))
        setBookings({ booked: roster.length, roster })
      })
      .catch(() => {
        /* best-effort — ignore */
      })
    return () => {
      cancelled = true
    }
  }, [cls.classGroupId, nextDate])

  const capacity = cls.capacity ?? 0
  const booked = bookings?.booked ?? 0
  const topRoster = bookings?.roster.slice(0, 3) ?? []

  // Price / member label
  let priceLabel: string
  if (cls.memberAccess === 'members_only') {
    priceLabel = 'Members only'
  } else if (cls.memberAccess === 'included') {
    priceLabel = `${formatCents(cls.priceCents)} · members free`
  } else {
    priceLabel = formatCents(cls.priceCents)
  }

  // Schedule badge
  let scheduleBadge: string
  if (!cls.recurring && cls.oneTimeDate) {
    scheduleBadge = `one-time · ${fmtDate(cls.oneTimeDate)}`
  } else {
    scheduleBadge = 'weekly'
  }

  const accentColor = safeHexColor(cls.color) ?? 'var(--accent)'
  const pct = capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0

  return (
    <div className="arcade-tile arcade-lift flex overflow-hidden bg-[var(--bg-subtle)]">
      {/* Left color stripe */}
      <div className="w-1.5 shrink-0 border-r-2 border-[var(--ink)]" style={{ backgroundColor: accentColor }} />

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        {/* Top row: name + type tag + schedule badge */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-[family-name:var(--font-display)] text-base font-extrabold tracking-[-0.02em] text-[var(--text-primary)] truncate">
                {cls.name ?? 'Untitled'}
              </h3>
              {cls.type && (
                <span className="arcade-badge">
                  {cls.type}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {/* Recurring / one-time badge */}
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor: `${accentColor}22`,
                  color: accentColor,
                }}
              >
                {cls.recurring ? (
                  <svg className="size-3" fill="none" viewBox="0 0 16 16" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 8a6 6 0 1110.47-3.47M12 4.5V2m0 2.5H9.5" />
                  </svg>
                ) : null}
                {scheduleBadge}
              </span>

              {/* Status if draft */}
              {cls.status === 'draft' && (
                <span className="arcade-badge">draft</span>
              )}
            </div>
          </div>
        </div>

        {/* Time + Location row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-secondary)]">
          <span className="font-medium tabular-nums">
            {cls.startTime ? timeLabel(cls.startTime.slice(0, 5)) : '—'}
            {cls.startTime && cls.durationMinutes
              ? ` – ${timeLabel(addMinutes(cls.startTime.slice(0, 5), cls.durationMinutes))}`
              : ''}
          </span>
          {cls.location && (
            <span className="truncate text-[var(--text-tertiary)]">{cls.location}</span>
          )}
        </div>

        {/* Booked row */}
        <div className="flex items-center gap-2">
          {/* Avatar stack */}
          {topRoster.length > 0 && (
            <div className="flex -space-x-1.5">
              {topRoster.map((r, i) => (
                <Avatar key={i} name={r.name} photoUrl={r.photoUrl} size={22} />
              ))}
            </div>
          )}
          <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
            <Users className="size-3.5 shrink-0" />
            <span>
              <span className={booked > 0 ? 'font-[family-name:var(--font-display)] font-bold text-[var(--text-secondary)]' : ''}>
                {booked}
              </span>
              {' '}/ {capacity > 0 ? capacity : '—'} booked
            </span>
          </span>
        </div>

        {/* Capacity progress */}
        {capacity > 0 && (
          <div className="arcade-track">
            <div className="arcade-fill arcade-fill-yellow" style={{ width: `${pct}%` }} />
          </div>
        )}

        {/* Price row */}
        <p className="font-[family-name:var(--font-display)] text-xs font-bold text-[var(--text-secondary)]">{priceLabel}</p>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => nextDate && onOpenBookings(cls, nextDate)}
            disabled={!nextDate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <BookOpen className="size-3.5" />
            Bookings
          </button>
          <button
            type="button"
            onClick={() => onEdit(cls)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]"
          >
            <Pencil className="size-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(cls)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--error-border)] hover:bg-[var(--error-bg)] hover:text-[var(--error)]"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main schedule view — grouped by weekday
// ---------------------------------------------------------------------------

export function ClassScheduleView({ classes, onEdit, onDelete, onOpenBookings }: ClassScheduleViewProps) {
  if (classes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] p-10 text-center">
        <p className="text-sm font-medium text-[var(--text-primary)]">No classes yet — create your first</p>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          Use the New class button above to put a class on your weekly schedule.
        </p>
      </div>
    )
  }

  // Compute next occurrence per class
  const classesWithDates = classes.map((cls) => ({
    cls,
    nextDate: nextOccurrence(cls),
  }))

  // Group by the weekday of their next occurrence (or oneTimeDate weekday for one-time classes)
  // Day bucket key: 0=Mon..6=Sun  (our convention)
  type DayBucket = { dayIndex: number; label: string; items: typeof classesWithDates }
  const buckets = new Map<number, DayBucket>()

  for (const item of classesWithDates) {
    if (item.cls.recurring && item.cls.days && item.cls.days.length > 0) {
      // Recurring class: one card per day it runs on
      for (const d of item.cls.days) {
        if (!buckets.has(d)) {
          buckets.set(d, { dayIndex: d, label: WEEKDAYS[d]?.long ?? `Day ${d}`, items: [] })
        }
        // Compute a per-day nextDate for recurring (next occurrence on day d)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const jsDow = today.getDay()
        const ourDow = (jsDow + 6) % 7
        let diff = d - ourDow
        if (diff < 0) diff += 7
        const candidate = new Date(today)
        candidate.setDate(today.getDate() + diff)
        const yyyy = candidate.getFullYear()
        const mm = String(candidate.getMonth() + 1).padStart(2, '0')
        const dd = String(candidate.getDate()).padStart(2, '0')
        const perDayNextDate = `${yyyy}-${mm}-${dd}`

        // Push a copy pointing at this day's nextDate
        buckets.get(d)!.items.push({ cls: item.cls, nextDate: perDayNextDate })
      }
    } else if (!item.cls.recurring && item.cls.oneTimeDate) {
      // One-time: bucket by the weekday of that date
      const [yyyy, mm, dd] = item.cls.oneTimeDate.split('-').map(Number)
      const dateObj = new Date(yyyy ?? 0, (mm ?? 1) - 1, dd ?? 1)
      const jsDow = dateObj.getDay()
      const ourDow = (jsDow + 6) % 7
      if (!buckets.has(ourDow)) {
        buckets.set(ourDow, {
          dayIndex: ourDow,
          label: WEEKDAYS[ourDow]?.long ?? `Day ${ourDow}`,
          items: [],
        })
      }
      buckets.get(ourDow)!.items.push(item)
    } else {
      // Fallback: unscheduled — put in Monday bucket
      if (!buckets.has(0)) {
        buckets.set(0, { dayIndex: 0, label: WEEKDAYS[0]?.long ?? 'Monday', items: [] })
      }
      buckets.get(0)!.items.push(item)
    }
  }

  // Sort buckets Mon→Sun
  const sorted = Array.from(buckets.values()).sort((a, b) => a.dayIndex - b.dayIndex)

  return (
    <div className="space-y-6">
      {sorted.map((bucket) => (
        <section key={bucket.dayIndex}>
          <h2 className="mb-3 flex items-center gap-2 font-[family-name:var(--font-display)] text-xs font-extrabold uppercase tracking-widest text-[var(--text-secondary)]">
            {bucket.label}
            <span className="arcade-badge-dark inline-flex items-center rounded-full border-2 border-[var(--ink)] px-2 py-0.5 text-[10px] font-bold tabular-nums">
              {bucket.items.length}
            </span>
          </h2>
          <div className="space-y-3">
            {bucket.items.map(({ cls, nextDate }) => (
              <ClassCard
                key={`${cls.classGroupId}-${bucket.dayIndex}-${nextDate ?? 'none'}`}
                cls={cls}
                nextDate={nextDate}
                onEdit={onEdit}
                onDelete={onDelete}
                onOpenBookings={onOpenBookings}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
