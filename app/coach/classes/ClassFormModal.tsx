'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Loader2, ChevronDown } from 'lucide-react'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Mon=0 … Sun=6 — matches the codebase-wide day_of_week convention. */
const WEEKDAYS = [
  { value: 0, short: 'Mon', long: 'Monday' },
  { value: 1, short: 'Tue', long: 'Tuesday' },
  { value: 2, short: 'Wed', long: 'Wednesday' },
  { value: 3, short: 'Thu', long: 'Thursday' },
  { value: 4, short: 'Fri', long: 'Friday' },
  { value: 5, short: 'Sat', long: 'Saturday' },
  { value: 6, short: 'Sun', long: 'Sunday' },
] as const

const CLASS_TYPES = [
  'Boxing',
  'BJJ',
  'Muay Thai',
  'MMA',
  'Kickboxing',
  'Wrestling',
  'Judo',
  'Karate',
  'Yoga',
  'Strength',
  'Conditioning',
  'Personal Training',
]

const DURATION_PRESETS = [
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
  { label: '90 min', value: 90 },
]

const COLOR_SWATCHES = [
  '#c8882e', // brass / brand
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClassRecord = {
  classGroupId: string
  name: string | null
  type: string | null
  description: string | null
  location: string | null
  capacity: number | null
  priceCents: number
  currency: string
  durationMinutes: number | null
  startTime: string
  color: string | null
  status: string
  memberAccess: string
  isVirtual: boolean
  recurring: boolean
  days: number[] | null
  oneTimeDate: string | null
}

type FormErrors = Partial<Record<string, string>>

interface FormState {
  name: string
  type: string
  description: string
  location: string
  capacity: string
  priceDollars: string
  durationMinutes: number | 'custom'
  customDuration: string
  startTime: string
  color: string
  status: 'active' | 'draft'
  memberAccess: 'included' | 'members_only' | 'drop_in_only'
  isVirtual: boolean
  recurring: boolean
  days: number[]
  oneTimeDate: string
}

export interface ClassFormModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editClass?: ClassRecord | undefined
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function blankForm(): FormState {
  return {
    name: '',
    type: '',
    description: '',
    location: '',
    capacity: '10',
    priceDollars: '0',
    durationMinutes: 60,
    customDuration: '',
    startTime: '09:00',
    color: COLOR_SWATCHES[0]!,
    status: 'active',
    memberAccess: 'drop_in_only',
    isVirtual: false,
    recurring: true,
    days: [],
    oneTimeDate: '',
  }
}

function formFromRecord(c: ClassRecord): FormState {
  const durPreset = DURATION_PRESETS.find((d) => d.value === (c.durationMinutes ?? 60))
  return {
    name: c.name ?? '',
    type: c.type ?? '',
    description: c.description ?? '',
    location: c.location ?? '',
    capacity: String(c.capacity ?? 10),
    priceDollars: ((c.priceCents ?? 0) / 100).toFixed(2),
    durationMinutes: durPreset ? durPreset.value : 'custom',
    customDuration: durPreset ? '' : String(c.durationMinutes ?? 60),
    startTime: c.startTime ? c.startTime.slice(0, 5) : '09:00',
    color: c.color ?? COLOR_SWATCHES[0]!,
    status: (c.status === 'active' || c.status === 'draft') ? c.status : 'active',
    memberAccess:
      c.memberAccess === 'included' || c.memberAccess === 'members_only' || c.memberAccess === 'drop_in_only'
        ? c.memberAccess
        : 'drop_in_only',
    isVirtual: c.isVirtual ?? false,
    recurring: c.recurring ?? true,
    days: c.days ?? [],
    oneTimeDate: c.oneTimeDate ?? '',
  }
}

function validate(f: FormState): FormErrors {
  const errs: FormErrors = {}
  if (!f.name.trim()) errs.name = 'Name is required'
  if (!f.type.trim()) errs.type = 'Type / category is required'
  const cap = parseInt(f.capacity, 10)
  if (isNaN(cap) || cap < 1) errs.capacity = 'Capacity must be at least 1'
  const price = parseFloat(f.priceDollars)
  if (isNaN(price) || price < 0) errs.priceDollars = 'Price must be 0 or more'
  const dur =
    f.durationMinutes === 'custom'
      ? parseInt(f.customDuration, 10)
      : f.durationMinutes
  if (isNaN(dur) || dur < 5) errs.durationMinutes = 'Duration must be at least 5 minutes'
  if (!f.startTime) errs.startTime = 'Start time is required'
  if (f.recurring) {
    if (f.days.length === 0) errs.days = 'Select at least one day'
  } else {
    if (!f.oneTimeDate) errs.oneTimeDate = 'Select a date for this session'
  }
  return errs
}

function buildPayload(f: FormState) {
  const priceCents = Math.round(parseFloat(f.priceDollars) * 100)
  const durationMinutes =
    f.durationMinutes === 'custom'
      ? parseInt(f.customDuration, 10)
      : f.durationMinutes
  return {
    name: f.name.trim(),
    type: f.type.trim(),
    description: f.description.trim() || null,
    location: f.location.trim() || null,
    capacity: parseInt(f.capacity, 10),
    priceCents,
    currency: 'usd',
    durationMinutes,
    startTime: f.startTime,
    color: f.color || null,
    status: f.status,
    memberAccess: f.memberAccess,
    isVirtual: f.isVirtual,
    recurring: f.recurring,
    days: f.recurring ? f.days : undefined,
    oneTimeDate: f.recurring ? undefined : f.oneTimeDate,
  }
}

// ---------------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------------

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === opt.value
              ? 'bg-[var(--accent)] text-white shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ClassFormModal({ open, onClose, onSaved, editClass }: ClassFormModalProps) {
  const [form, setForm] = useState<FormState>(blankForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const typelistId = 'class-type-datalist'

  // Re-populate form when modal opens or editClass changes
  useEffect(() => {
    if (open) {
      setForm(editClass ? formFromRecord(editClass) : blankForm())
      setErrors({})
      setSubmitError(null)
    }
  }, [open, editClass])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function toggleDay(day: number) {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day],
    }))
    setErrors((prev) => ({ ...prev, days: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setSubmitError(null)
    setSaving(true)
    try {
      const payload = buildPayload(form)
      let res: Response
      if (editClass) {
        res = await fetch(`/api/coach/classes/${editClass.classGroupId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, scope: 'all' }),
        })
      } else {
        res = await fetch('/api/coach/classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSubmitError((json as { error?: string }).error ?? 'Something went wrong — try again')
        return
      }
      onSaved()
      onClose()
    } catch {
      setSubmitError('Network error — try again')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const isEdit = Boolean(editClass)

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit class' : 'New class'}
    >
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-[var(--border-default)] bg-[var(--bg-app)] shadow-2xl max-h-[92dvh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-5 py-4">
          <h2 className="font-display text-lg font-medium text-[var(--text-primary)]">
            {isEdit ? 'Edit class' : 'New class'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5 px-5 py-5">

            {/* Name */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Class name <span className="text-[var(--error)]">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Saturday Morning BJJ"
                maxLength={200}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              {errors.name && <p className="mt-1 text-xs text-[var(--error)]">{errors.name}</p>}
            </div>

            {/* Type */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Type / category <span className="text-[var(--error)]">*</span>
              </label>
              <input
                type="text"
                list={typelistId}
                value={form.type}
                onChange={(e) => set('type', e.target.value)}
                placeholder="e.g. BJJ, Boxing, Conditioning…"
                maxLength={100}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <datalist id={typelistId}>
                {CLASS_TYPES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              {errors.type && <p className="mt-1 text-xs text-[var(--error)]">{errors.type}</p>}
            </div>

            {/* Color */}
            <div>
              <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">
                Color
              </label>
              <div className="flex items-center gap-2">
                {COLOR_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => set('color', hex)}
                    style={{ backgroundColor: hex }}
                    className={[
                      'size-7 rounded-full transition-transform focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--accent)]',
                      form.color === hex
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--bg-app)] scale-110'
                        : 'hover:scale-105',
                    ].join(' ')}
                    aria-label={hex}
                    aria-pressed={form.color === hex}
                  />
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Description
                <span className="ml-1 text-[var(--text-quaternary)] font-normal">(optional)</span>
              </label>
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="What to expect, prerequisites, what to bring…"
                rows={3}
                maxLength={2000}
                className="w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            {/* Location */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Location
                <span className="ml-1 text-[var(--text-quaternary)] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="Address, or 'Zoom — link sent after booking'"
                maxLength={300}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            {/* Capacity + Price */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Capacity <span className="text-[var(--error)]">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => set('capacity', e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
                {errors.capacity && (
                  <p className="mt-1 text-xs text-[var(--error)]">{errors.capacity}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Price per session <span className="text-[var(--error)]">*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-[var(--text-tertiary)]">
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.priceDollars}
                    onChange={(e) => set('priceDollars', e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] pl-7 pr-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
                {errors.priceDollars && (
                  <p className="mt-1 text-xs text-[var(--error)]">{errors.priceDollars}</p>
                )}
              </div>
            </div>

            {/* Start time + Duration */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Start time <span className="text-[var(--error)]">*</span>
                </label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => set('startTime', e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
                {errors.startTime && (
                  <p className="mt-1 text-xs text-[var(--error)]">{errors.startTime}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Duration <span className="text-[var(--error)]">*</span>
                </label>
                <div className="relative">
                  <select
                    value={form.durationMinutes}
                    onChange={(e) => {
                      const v = e.target.value
                      set('durationMinutes', v === 'custom' ? 'custom' : (parseInt(v, 10) as 30 | 45 | 60 | 90))
                    }}
                    className="w-full appearance-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 pr-8 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  >
                    {DURATION_PRESETS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                    <option value="custom">Custom…</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-tertiary)]" />
                </div>
                {form.durationMinutes === 'custom' && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={5}
                      max={480}
                      placeholder="minutes"
                      value={form.customDuration}
                      onChange={(e) => set('customDuration', e.target.value)}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                    <span className="shrink-0 text-xs text-[var(--text-tertiary)]">min</span>
                  </div>
                )}
                {errors.durationMinutes && (
                  <p className="mt-1 text-xs text-[var(--error)]">{errors.durationMinutes}</p>
                )}
              </div>
            </div>

            {/* Repeat weekly toggle + day chips / one-time date */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Repeat weekly</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.recurring}
                  onClick={() => {
                    set('recurring', !form.recurring)
                    setErrors((prev) => ({ ...prev, days: undefined, oneTimeDate: undefined }))
                  }}
                  className={[
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1',
                    form.recurring ? 'bg-[var(--accent)]' : 'bg-[var(--border-default)]',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'pointer-events-none inline-block size-4 rounded-full bg-white shadow transition-transform duration-200',
                      form.recurring ? 'translate-x-4' : 'translate-x-0',
                    ].join(' ')}
                  />
                </button>
              </div>

              {form.recurring ? (
                <div>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((d) => {
                      const active = form.days.includes(d.value)
                      return (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => toggleDay(d.value)}
                          aria-pressed={active}
                          className={[
                            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors border focus:outline-none focus:ring-1 focus:ring-[var(--accent)]',
                            active
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                              : 'border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
                          ].join(' ')}
                        >
                          {d.short}
                        </button>
                      )
                    })}
                  </div>
                  {errors.days && (
                    <p className="mt-1.5 text-xs text-[var(--error)]">{errors.days}</p>
                  )}
                </div>
              ) : (
                <div>
                  <input
                    type="date"
                    value={form.oneTimeDate}
                    onChange={(e) => set('oneTimeDate', e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                  {errors.oneTimeDate && (
                    <p className="mt-1 text-xs text-[var(--error)]">{errors.oneTimeDate}</p>
                  )}
                </div>
              )}
            </div>

            {/* Member access */}
            <div>
              <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">
                Member access
              </label>
              <Segmented
                options={[
                  { label: 'Included', value: 'included' },
                  { label: 'Members only', value: 'members_only' },
                  { label: 'Drop-in', value: 'drop_in_only' },
                ]}
                value={form.memberAccess}
                onChange={(v) => set('memberAccess', v)}
              />
            </div>

            {/* Status */}
            <div>
              <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">
                Status
              </label>
              <Segmented
                options={[
                  { label: 'Active', value: 'active' },
                  { label: 'Draft', value: 'draft' },
                ]}
                value={form.status}
                onChange={(v) => set('status', v)}
              />
            </div>

            {/* Virtual toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--text-secondary)]">Virtual class</p>
                <p className="text-xs text-[var(--text-quaternary)]">Clients join online (Zoom, Meet, etc.)</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.isVirtual}
                onClick={() => set('isVirtual', !form.isVirtual)}
                className={[
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1',
                  form.isVirtual ? 'bg-[var(--accent)]' : 'bg-[var(--border-default)]',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none inline-block size-4 rounded-full bg-white shadow transition-transform duration-200',
                    form.isVirtual ? 'translate-x-4' : 'translate-x-0',
                  ].join(' ')}
                />
              </button>
            </div>

          </div>

          {/* Footer */}
          <div className="sticky bottom-0 border-t border-[var(--border-subtle)] bg-[var(--bg-app)] px-5 py-4">
            {submitError && (
              <p className="mb-3 text-sm text-[var(--error)]">{submitError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[var(--accent-hover)] disabled:cursor-wait disabled:opacity-70"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save changes' : 'Create class')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
