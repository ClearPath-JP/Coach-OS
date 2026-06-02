'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Loader2, Users, Calendar, Trash2, AlertTriangle, Pencil } from 'lucide-react'
import { formatCents } from '@/lib/format-currency'
import { ClassFormModal, type ClassRecord } from './ClassFormModal'

const WEEKDAYS = [
  { value: 0, short: 'Mon', long: 'Monday' },
  { value: 1, short: 'Tue', long: 'Tuesday' },
  { value: 2, short: 'Wed', long: 'Wednesday' },
  { value: 3, short: 'Thu', long: 'Thursday' },
  { value: 4, short: 'Fri', long: 'Friday' },
  { value: 5, short: 'Sat', long: 'Saturday' },
  { value: 6, short: 'Sun', long: 'Sunday' },
] as const

const TIME_OPTIONS: string[] = (() => {
  const out: string[] = []
  for (let h = 5; h <= 22; h++) {
    for (const m of [0, 30]) {
      if (h === 22 && m === 30) break
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return out
})()

function timeLabel(t: string) {
  const [h, m] = t.split(':').map((x) => parseInt(x, 10))
  if (h == null) return t
  const d = new Date(2000, 0, 1, h, m ?? 0)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

type Package = {
  id: string
  title: string
  price_cents: number
  duration_minutes: number
  capacity?: number
  is_active: boolean
}

type Slot = {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  label: string | null
  session_product_id: string | null
  is_client_bookable: boolean
  is_active: boolean
}

export function CoachClassesContent() {
  const [packages, setPackages] = useState<Package[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stripeConnected, setStripeConnected] = useState<boolean | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<{ packageId: string; dayOfWeek: number; startTime: string }>({
    packageId: '',
    dayOfWeek: 0,
    startTime: '09:00',
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // New class form modal
  const [classModalOpen, setClassModalOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassRecord | undefined>(undefined)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [pkgsRes, slotsRes, settingsRes, classesRes] = await Promise.all([
        fetch('/api/packages'),
        fetch('/api/availability'),
        fetch('/api/settings/workspace'),
        fetch('/api/coach/classes'),
      ])
      const pkgsJson = await pkgsRes.json().catch(() => ({}))
      const slotsJson = await slotsRes.json().catch(() => ({}))
      const settingsJson = await settingsRes.json().catch(() => ({}))
      const classesJson = await classesRes.json().catch(() => ({}))
      if (!pkgsRes.ok) throw new Error(pkgsJson.error ?? 'Could not load packages')
      if (!slotsRes.ok) throw new Error(slotsJson.error ?? 'Could not load slots')
      setPackages((pkgsJson.data ?? []).filter((p: Package) => p.is_active))
      setSlots((slotsJson.data ?? []).filter((s: Slot) => s.is_active))
      // Classes API failure is non-fatal — the legacy slots list still works
      if (classesRes.ok) {
        const raw = classesJson?.data?.classes
        setClasses(Array.isArray(raw) ? (raw as ClassRecord[]) : [])
      } else {
        setClasses([])
      }
      const connectedId =
        settingsJson?.data?.stripe_connect_account_id || settingsJson?.stripe_connect_account_id
      setStripeConnected(Boolean(connectedId))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const bookableSlots = useMemo(
    () => slots.filter((s) => s.is_client_bookable && s.session_product_id),
    [slots]
  )

  const packagesById = useMemo(() => {
    const m = new Map<string, Package>()
    for (const p of packages) m.set(p.id, p)
    return m
  }, [packages])

  async function addSlot(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.packageId) {
      setFormError('Pick a class type first.')
      return
    }
    const pkg = packagesById.get(form.packageId)
    if (!pkg) {
      setFormError('Class type not found.')
      return
    }
    setSaving(true)
    try {
      // Calculate end time from package duration
      const [sh, sm] = form.startTime.split(':').map((x) => parseInt(x, 10))
      const start = new Date(2000, 0, 1, sh ?? 9, sm ?? 0)
      const end = new Date(start.getTime() + (pkg.duration_minutes ?? 60) * 60_000)
      const endHH = String(end.getHours()).padStart(2, '0')
      const endMM = String(end.getMinutes()).padStart(2, '0')

      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayOfWeek: form.dayOfWeek,
          startTime: `${form.startTime}:00`,
          endTime: `${endHH}:${endMM}:00`,
          sessionProductId: form.packageId,
          isClientBookable: true,
          label: pkg.title,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFormError(json.error ?? 'Could not add class slot')
        return
      }
      setAddOpen(false)
      setForm({ packageId: '', dayOfWeek: 0, startTime: '09:00' })
      await load()
    } catch {
      setFormError('Network error — try again')
    } finally {
      setSaving(false)
    }
  }

  async function removeSlot(id: string) {
    if (!window.confirm('Remove this class slot? Existing paid bookings will be kept.')) return
    const res = await fetch(`/api/availability/${id}`, { method: 'DELETE' })
    if (res.ok) {
      void load()
    }
  }

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[28px] font-medium tracking-tight text-[var(--text-primary)]">
              Classes
            </h1>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">
              Create classes your clients can pay to book — weekly recurring or one-time sessions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAddOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)]"
            >
              <Plus className="size-4" />
              Add slot (legacy)
            </button>
            <button
              type="button"
              onClick={() => { setEditingClass(undefined); setClassModalOpen(true) }}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--accent-hover)]"
            >
              <Plus className="size-4" />
              New class
            </button>
          </div>
        </header>

        {stripeConnected === false && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning)]"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Stripe not connected yet</p>
              <p className="mt-1 text-xs">
                Clients can&apos;t pay until you finish Stripe onboarding.{' '}
                <Link href="/coach/settings?tab=payments" className="underline">
                  Connect Stripe
                </Link>
              </p>
            </div>
          </div>
        )}

        {packages.length === 0 && !loading && (
          <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] p-6 text-sm">
            <p className="font-medium text-[var(--text-primary)]">No class types yet</p>
            <p className="mt-1 text-[var(--text-tertiary)]">
              Create a package first — set the title, price, duration, and capacity. Then come back to put it on the calendar.
            </p>
            <Link
              href="/coach/packages"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              Create a package →
            </Link>
          </div>
        )}

        {addOpen && packages.length > 0 && (
          <form
            onSubmit={addSlot}
            className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-5 space-y-4"
          >
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Add a class slot</h2>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Class type
              </label>
              <select
                value={form.packageId}
                onChange={(e) => setForm((f) => ({ ...f, packageId: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)]"
                required
              >
                <option value="">Pick a class…</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} — {formatCents(p.price_cents)} · {p.duration_minutes}min · cap {p.capacity ?? 1}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Day</label>
                <select
                  value={form.dayOfWeek}
                  onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: parseInt(e.target.value, 10) }))}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.long}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Start time</label>
                <select
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {timeLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formError && <p className="text-sm text-[var(--error)]">{formError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[var(--accent-hover)] disabled:cursor-wait disabled:opacity-70"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving ? 'Adding…' : 'Add slot'}
              </button>
            </div>
          </form>
        )}

        {loading && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-10 text-center">
            <Loader2 className="mx-auto size-5 animate-spin text-[var(--text-tertiary)]" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] p-4 text-sm text-[var(--error)]">
            {error}
          </div>
        )}

        {!loading && !error && bookableSlots.length === 0 && packages.length > 0 && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-8 text-center">
            <Calendar className="mx-auto mb-3 size-6 text-[var(--accent)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">No class slots scheduled yet</p>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">Put one of your class types on the weekly calendar.</p>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--text-on-accent)] transition-colors hover:bg-[var(--accent-hover)]"
            >
              <Plus size={16} /> New class slot
            </button>
          </div>
        )}

        {!loading && !error && bookableSlots.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)]">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 border-b border-[var(--border-subtle)] px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-quaternary)]">
              <span>Day</span>
              <span>Class</span>
              <span className="text-right">Time</span>
              <span className="text-right">Capacity</span>
              <span />
            </div>
            <ul>
              {bookableSlots.map((s) => {
                const pkg = s.session_product_id ? packagesById.get(s.session_product_id) : null
                return (
                  <li
                    key={s.id}
                    className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-4 last:border-b-0"
                  >
                    <span className="font-display text-sm font-medium text-[var(--accent)]">
                      {WEEKDAYS[s.day_of_week]?.short ?? '?'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {pkg?.title ?? s.label ?? 'Class'}
                      </p>
                      {pkg && (
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {formatCents(pkg.price_cents)}
                        </p>
                      )}
                    </div>
                    <span className="text-right text-sm text-[var(--text-secondary)]">
                      {timeLabel(s.start_time.slice(0, 5))}
                    </span>
                    <span className="inline-flex items-center gap-1 text-right text-xs text-[var(--text-tertiary)]">
                      <Users className="size-3" />
                      {pkg?.capacity ?? 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSlot(s.id)}
                      className="text-[var(--text-tertiary)] hover:text-[var(--error)]"
                      aria-label="Remove slot"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        {/* ------------------------------------------------------------------ */}
        {/* Classes created via the new form modal                             */}
        {/* ------------------------------------------------------------------ */}
        {classes.length > 0 && (
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--text-quaternary)]">
              Your classes
            </h2>
            <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)]">
              <ul>
                {classes.map((cls) => {
                  const scheduleLabel = cls.recurring
                    ? (cls.days ?? [])
                        .map((d) => WEEKDAYS[d]?.short ?? '?')
                        .join(', ')
                    : (cls.oneTimeDate ?? 'One-time')
                  return (
                    <li
                      key={cls.classGroupId}
                      className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-4 last:border-b-0"
                    >
                      {/* Color dot */}
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: cls.color ?? 'var(--accent)' }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {cls.name ?? 'Untitled'}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {cls.type ?? ''}{cls.type && scheduleLabel ? ' · ' : ''}{scheduleLabel}
                          {cls.startTime ? ` · ${timeLabel(cls.startTime.slice(0, 5))}` : ''}
                          {cls.durationMinutes ? ` · ${cls.durationMinutes}min` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm text-[var(--text-secondary)]">
                          {formatCents(cls.priceCents)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                          <Users className="size-3" />
                          {cls.capacity ?? '—'}
                        </span>
                        <span
                          className={[
                            'rounded-full px-2 py-0.5 text-[11px] font-medium',
                            cls.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-[var(--bg-muted)] text-[var(--text-quaternary)]',
                          ].join(' ')}
                        >
                          {cls.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => { setEditingClass(cls); setClassModalOpen(true) }}
                          className="text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
                          aria-label={`Edit ${cls.name ?? 'class'}`}
                        >
                          <Pencil className="size-4" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )}

      </div>

      {/* Class form modal — create + edit */}
      <ClassFormModal
        open={classModalOpen}
        onClose={() => { setClassModalOpen(false); setEditingClass(undefined) }}
        onSaved={() => { void load() }}
        editClass={editingClass}
      />
    </main>
  )
}
