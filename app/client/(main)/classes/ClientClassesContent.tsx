'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { Clock, Users, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { formatCents } from '@/lib/format-currency'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

type ClassInstance = {
  instanceKey: string
  slotId: string
  packageId: string
  instanceDate: string
  scheduledTimeISO: string
  startTime: string
  endTime: string
  title: string
  durationMinutes: number
  priceCents: number
  capacity: number
  bookedCount: number
  spotsRemaining: number
  myBookingStatus: 'none' | 'booked' | 'paid'
}

function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10))
  if (h == null) return hhmm
  const d = new Date(2000, 0, 1, h, m ?? 0)
  return format(d, 'h:mm a')
}

export function ClientClassesContent() {
  const searchParams = useSearchParams()
  const justBooked = searchParams.get('booked') === '1'
  const bookingCancelled = searchParams.get('booking_cancelled') === '1'

  const [instances, setInstances] = useState<ClassInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [bookError, setBookError] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ type: 'success' | 'warning'; text: string } | null>(
    justBooked
      ? { type: 'success', text: "You're booked — your coach has been notified." }
      : bookingCancelled
        ? { type: 'warning', text: 'Booking cancelled. No charge was made.' }
        : null
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/client/available-classes', { credentials: 'include' })
      const json = (await res.json().catch(() => ({}))) as { data?: ClassInstance[]; error?: string }
      if (!res.ok) {
        setError(json.error ?? 'Could not load classes')
        return
      }
      setInstances(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Auto-dismiss banner after 6s
  useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner(null), 6000)
    return () => window.clearTimeout(t)
  }, [banner])

  const grouped = useMemo(() => {
    const map = new Map<string, ClassInstance[]>()
    for (const i of instances) {
      const list = map.get(i.instanceDate) ?? []
      list.push(i)
      map.set(i.instanceDate, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1))
  }, [instances])

  async function book(inst: ClassInstance) {
    setBookError(null)
    setBookingId(inst.instanceKey)
    try {
      const res = await fetch('/api/client/book-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slotId: inst.slotId, instanceDate: inst.instanceDate }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { url?: string; booked?: boolean; passUsed?: boolean; membershipUsed?: boolean }
        error?: string
      }
      if (!res.ok) {
        setBookError(json.error ?? 'Could not start booking')
        setBookingId(null)
        return
      }
      if (json.data?.booked === true) {
        // Pass/membership-covered booking — no Stripe checkout, no URL. The credit is
        // already spent server-side, so this is a success, not a missing link.
        setBookError(null)
        setBanner({
          type: 'success',
          text: json.data.passUsed
            ? "You're booked — covered by your pass."
            : json.data.membershipUsed
              ? "You're booked — covered by your membership."
              : "You're booked — your coach has been notified.",
        })
        await load()
        setBookingId(null)
        return
      }
      const url = json.data?.url
      if (url) {
        // Guard against open-redirect: only allow Stripe Checkout URLs.
        let parsed: URL | null = null
        try { parsed = new URL(url) } catch { /* invalid URL */ }
        if (parsed && parsed.protocol === 'https:' && parsed.hostname === 'checkout.stripe.com') {
          window.location.assign(url)
          return
        }
        setBookError('Unexpected booking URL — please contact support')
        setBookingId(null)
        return
      }
      setBookError('Booking link missing')
      setBookingId(null)
    } catch {
      setBookError('Network error — please try again')
      setBookingId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-[30px] font-extrabold tracking-[-0.03em] text-[var(--text-primary)]">
          Book a class
        </h1>
        <p className="text-sm text-[var(--text-tertiary)]">
          See what your coach has open this month. Pay to secure your spot.
        </p>
      </header>

      {banner && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            banner.type === 'success'
              ? 'border-[var(--cp-accent)]/30 bg-[var(--cp-accent)]/10 text-[var(--cp-accent)]'
              : 'border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]'
          }`}
        >
          {banner.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
          )}
          <p>{banner.text}</p>
        </div>
      )}

      {bookError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{bookError}</p>
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-10 text-center">
          <Loader2 className="mx-auto size-5 animate-spin text-[var(--text-tertiary)]" />
          <p className="mt-3 text-sm text-[var(--text-tertiary)]">Loading classes…</p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] p-6 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      {!loading && !error && instances.length === 0 && (
        <Card padding="lg">
          <EmptyState
            title="No open classes right now"
            description="Your coach hasn't posted any bookable classes yet. Check back soon."
          />
        </Card>
      )}

      {!loading && !error && grouped.length > 0 && (
        <div className="space-y-6">
          {grouped.map(([dateStr, list]) => {
            const date = parseISO(dateStr)
            return (
              <section key={dateStr} className="space-y-3">
                <div className="flex items-baseline gap-3">
                  <h2 className="font-[family-name:var(--font-display)] text-[15px] font-extrabold uppercase tracking-[0.12em] text-[var(--cp-accent)]">
                    {format(date, 'EEEE')}
                  </h2>
                  <span className="text-sm text-[var(--text-tertiary)]">
                    {format(date, 'MMMM d')}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {list.map((inst) => {
                    const full = inst.spotsRemaining <= 0
                    const booked = inst.myBookingStatus !== 'none'
                    const isBooking = bookingId === inst.instanceKey
                    const fillPct = inst.capacity > 0
                      ? Math.max(0, Math.min(100, (inst.bookedCount / inst.capacity) * 100))
                      : 0
                    return (
                      <div
                        key={inst.instanceKey}
                        className={`rounded-[16px] border-[3px] border-[var(--ink)] p-5 shadow-[5px_5px_0_var(--ink)] ${
                          booked ? 'bg-[var(--cp-accent)]/8' : 'bg-[var(--bg-subtle)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-[family-name:var(--font-display)] text-[17px] font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">
                              {inst.title}
                            </h3>
                            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                              <Clock className="size-3.5" />
                              {timeLabel(inst.startTime)} &middot; {inst.durationMinutes} min
                            </div>
                          </div>
                          <span className="arcade-badge arcade-badge-yellow shrink-0">
                            {formatCents(inst.priceCents)}
                          </span>
                        </div>

                        {/* Capacity track */}
                        <div className="mt-4">
                          <div className="mb-1.5 flex items-center justify-between font-[family-name:var(--font-display)] text-[11px] font-bold text-[var(--text-secondary)]">
                            <span className="inline-flex items-center gap-1.5">
                              <Users className="size-3.5" />
                              {inst.bookedCount}/{inst.capacity} booked
                            </span>
                            <span className={full ? 'text-[var(--belt-coral)]' : ''}>
                              {full ? 'Full' : `${inst.spotsRemaining} left`}
                            </span>
                          </div>
                          <div className="arcade-track h-2.5">
                            <div
                              className={`arcade-fill ${full ? 'arcade-fill-coral' : ''}`}
                              style={{ width: `${fillPct}%` }}
                            />
                          </div>
                        </div>

                        <div className="mt-4">
                          {booked ? (
                            <span className="arcade-badge arcade-badge-teal">
                              <CheckCircle2 className="size-3.5" />
                              You&apos;re booked
                            </span>
                          ) : full ? (
                            <Button variant="secondary" disabled fullWidth>
                              Class full
                            </Button>
                          ) : (
                            <Button
                              onClick={() => book(inst)}
                              disabled={isBooking}
                              loading={isBooking}
                              fullWidth
                            >
                              {isBooking ? 'Redirecting to checkout…' : 'Book & pay'}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
