'use client'

import { useCallback, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Star,
  XCircle,
} from 'lucide-react'
import { formatCents } from '@/lib/format-currency'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

// ─── Types ──────────────────────────────────────────────────────────────────

type Plan = {
  id: string
  name: string
  price_cents: number
  currency: string
  access_type: 'unlimited' | 'limited' | 'specific'
  classes_per_period: number | null
  applies_to: 'all' | 'types'
  applies_to_types: string[] | null
}

type Membership = {
  id: string
  status: 'active' | 'trialing' | 'past_due'
  current_period_end: string | null
  classes_used_this_period: number
  canceled_at: string | null
  plan_id: string
  plan_name: string | null
  plan_access_type: 'unlimited' | 'limited' | 'specific' | null
  plan_classes_per_period: number | null
}

type ApiData = {
  plans: Plan[]
  membership: Membership | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function accessLabel(plan: {
  access_type: 'unlimited' | 'limited' | 'specific' | null
  classes_per_period: number | null
}): string {
  if (plan.access_type === 'limited' && plan.classes_per_period != null) {
    return `${plan.classes_per_period} classes per month`
  }
  if (plan.access_type === 'specific') {
    return 'Specific classes'
  }
  return 'Unlimited classes'
}

function remainingLabel(membership: Membership): string {
  if (
    membership.plan_access_type === 'limited' &&
    membership.plan_classes_per_period != null
  ) {
    const used = membership.classes_used_this_period
    const total = membership.plan_classes_per_period
    const remaining = Math.max(0, total - used)
    return `${remaining} of ${total} classes left this month`
  }
  if (membership.plan_access_type === 'specific') {
    return 'Specific classes'
  }
  return 'Unlimited classes'
}

function humanizeType(raw: string): string {
  return raw
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function statusPill(status: Membership['status']) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--success-bg)] px-2.5 py-1 text-[12px] font-semibold text-[var(--success)]">
        <CheckCircle2 className="size-3.5" />
        Active
      </span>
    )
  }
  if (status === 'trialing') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--info-bg)] px-2.5 py-1 text-[12px] font-semibold text-[var(--info)]">
        <Star className="size-3.5" />
        Trial
      </span>
    )
  }
  // past_due
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--warning-bg)] px-2.5 py-1 text-[12px] font-semibold text-[var(--warning)]">
      <AlertCircle className="size-3.5" />
      Past due
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MembershipContent() {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Subscribe flow
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null)
  const [subscribeError, setSubscribeError] = useState<string | null>(null)

  // Cancel flow
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelledBanner, setCancelledBanner] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/client/memberships', { credentials: 'include' })
      const json = (await res.json().catch(() => ({}))) as {
        data?: ApiData
        error?: string
      }
      if (!res.ok) {
        setFetchError(json.error ?? 'Could not load membership info')
        return
      }
      setData(json.data ?? null)
    } catch {
      setFetchError('Network error — please refresh')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // ── Subscribe handler ────────────────────────────────────────────────────
  async function handleSubscribe(planId: string) {
    setSubscribeError(null)
    setSubscribingPlanId(planId)
    try {
      const res = await fetch('/api/client/membership-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planId }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { url?: string }
        error?: string
      }
      if (!res.ok) {
        // Surface friendly message for 503 (coach not connected)
        if (res.status === 503) {
          setSubscribeError(
            json.error ?? "Your coach hasn't finished setting up payments yet. Check back soon."
          )
        } else if (res.status === 409) {
          setSubscribeError(json.error ?? 'You already have an active membership.')
        } else {
          setSubscribeError(json.error ?? 'Could not start checkout — please try again')
        }
        setSubscribingPlanId(null)
        return
      }
      const url = json.data?.url
      if (url) {
        // Guard against open-redirect: only allow Stripe Checkout URLs.
        let parsed: URL | null = null
        try { parsed = new URL(url) } catch { /* invalid URL */ }
        if (parsed && parsed.protocol === 'https:' && parsed.hostname === 'checkout.stripe.com') {
          window.location.href = url
          return
        }
        setSubscribeError('Unexpected checkout URL — please contact support')
        setSubscribingPlanId(null)
        return
      }
      setSubscribeError('Checkout link missing — please try again')
      setSubscribingPlanId(null)
    } catch {
      setSubscribeError('Network error — please try again')
      setSubscribingPlanId(null)
    }
  }

  // ── Cancel handler ───────────────────────────────────────────────────────
  async function handleCancel() {
    setCancelError(null)
    setCancelling(true)
    try {
      const res = await fetch('/api/client/membership-cancel', {
        method: 'POST',
        credentials: 'include',
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: { ok: boolean }
        error?: string
      }
      if (!res.ok) {
        setCancelError(json.error ?? 'Could not cancel — please try again')
        setCancelling(false)
        setConfirmCancel(false)
        return
      }
      // Optimistic: mark the membership locally as cancelled
      setData((prev) => {
        if (!prev?.membership) return prev
        return {
          ...prev,
          membership: {
            ...prev.membership,
            canceled_at: new Date().toISOString(),
          },
        }
      })
      setCancelledBanner(true)
      setConfirmCancel(false)
      setCancelling(false)
    } catch {
      setCancelError('Network error — please try again')
      setCancelling(false)
      setConfirmCancel(false)
    }
  }

  // ── Render: loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-display text-[28px] font-medium tracking-tight text-[var(--text-primary)]">
            Membership
          </h1>
        </header>
        <Card className="p-10 text-center">
          <Loader2 className="mx-auto size-5 animate-spin text-[var(--text-tertiary)]" />
          <p className="mt-3 text-sm text-[var(--text-tertiary)]">Loading membership info...</p>
        </Card>
      </div>
    )
  }

  // ── Render: fetch error ──────────────────────────────────────────────────
  if (fetchError) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-display text-[28px] font-medium tracking-tight text-[var(--text-primary)]">
            Membership
          </h1>
        </header>
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{fetchError}</p>
        </div>
      </div>
    )
  }

  const { plans = [], membership = null } = data ?? {}

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* Header */}
      <header className="space-y-1">
        <h1 className="font-display text-[28px] font-medium tracking-tight text-[var(--text-primary)]">
          Membership
        </h1>
        <p className="text-sm text-[var(--text-tertiary)]">
          {membership
            ? 'Manage your membership with your coach.'
            : 'Subscribe to a membership plan for regular access.'}
        </p>
      </header>

      {/* Cancelled-at-period-end success banner */}
      {cancelledBanner && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-xl border border-[var(--cp-accent)]/30 bg-[var(--cp-accent)]/10 px-4 py-3 text-sm text-[var(--cp-accent)]"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <p>Your membership has been cancelled. It will remain active until the end of your current billing period.</p>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          ACTIVE MEMBERSHIP VIEW
          ════════════════════════════════════════════════ */}
      {membership ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-6">
          {/* Plan name + status */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Your plan
              </p>
              <h2 className="mt-1 text-[22px] font-semibold text-[var(--text-primary)]">
                {membership.plan_name ?? 'Membership'}
              </h2>
            </div>
            {statusPill(membership.status)}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {/* Classes remaining */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--cp-offwhite)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Classes
              </p>
              <p className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">
                {remainingLabel(membership)}
              </p>
            </div>

            {/* Renewal / end date */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--cp-offwhite)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                {membership.canceled_at ? 'Ends on' : 'Renews on'}
              </p>
              <p className="mt-1 text-[18px] font-semibold text-[var(--text-primary)]">
                {membership.current_period_end
                  ? format(parseISO(membership.current_period_end), 'MMMM d, yyyy')
                  : '—'}
              </p>
              {membership.canceled_at && !cancelledBanner && (
                <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">
                  Your membership ends on this date.
                </p>
              )}
            </div>
          </div>

          {/* Cancel section — only show if not already cancelled */}
          {!membership.canceled_at && !cancelledBanner && (
            <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
              {!confirmCancel ? (
                <button
                  type="button"
                  onClick={() => {
                    setCancelError(null)
                    setConfirmCancel(true)
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] shadow-[var(--shadow-xs)] transition-colors hover:border-[var(--error-border)] hover:bg-[var(--error-bg)] hover:text-[var(--error)]"
                >
                  <XCircle className="size-4" />
                  Cancel membership
                </button>
              ) : (
                <div className="space-y-3 rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] p-4">
                  <p className="text-[14px] font-medium text-[var(--error)]">
                    Are you sure? Your membership will remain active until the end of your current
                    billing period, then will not renew.
                  </p>
                  {cancelError && (
                    <p className="text-[13px] text-[var(--error)]">{cancelError}</p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleCancel()}
                      disabled={cancelling}
                      className="inline-flex items-center gap-2 rounded-lg bg-[var(--error)] px-4 py-2 text-sm font-medium text-white transition-opacity disabled:cursor-wait disabled:opacity-70"
                    >
                      {cancelling && <Loader2 className="size-4 animate-spin" />}
                      {cancelling ? 'Cancelling...' : 'Yes, cancel membership'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(false)}
                      disabled={cancelling}
                      className="rounded-lg border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] disabled:opacity-50"
                    >
                      Keep membership
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Already cancelled state (persistent, pre-loaded) */}
          {membership.canceled_at && !cancelledBanner && (
            <p className="mt-5 text-[13px] text-[var(--text-tertiary)]">
              Your membership is cancelled and ends on{' '}
              {membership.current_period_end
                ? format(parseISO(membership.current_period_end), 'MMMM d, yyyy')
                : 'the end of your billing period'}
              .
            </p>
          )}
        </div>
      ) : (
        /* ════════════════════════════════════════════════
           NO MEMBERSHIP — show plans or empty state
           ════════════════════════════════════════════════ */
        <>
          {subscribeError && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>{subscribeError}</p>
            </div>
          )}

          {plans.length === 0 ? (
            <EmptyState
              title="No membership plans yet"
              description="Your coach hasn't set up memberships yet. Check back soon."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {plans.map((plan) => {
                const isSubscribing = subscribingPlanId === plan.id
                return (
                  <div
                    key={plan.id}
                    className="flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-6"
                  >
                    <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
                      {plan.name}
                    </h2>

                    {/* Price */}
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="font-display text-[32px] font-medium text-[var(--text-primary)]">
                        {formatCents(plan.price_cents)}
                      </span>
                      <span className="text-[14px] text-[var(--text-tertiary)]">/mo</span>
                    </div>

                    {/* Access summary */}
                    <p className="mt-3 text-[14px] text-[var(--text-secondary)]">
                      {accessLabel(plan)}
                    </p>

                    {/* Applies-to types */}
                    {plan.applies_to === 'types' &&
                      plan.applies_to_types &&
                      plan.applies_to_types.length > 0 && (
                        <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">
                          Applies to:{' '}
                          {plan.applies_to_types.map(humanizeType).join(', ')}
                        </p>
                      )}

                    <div className="mt-auto pt-5">
                      <button
                        type="button"
                        onClick={() => void handleSubscribe(plan.id)}
                        disabled={isSubscribing || subscribingPlanId !== null}
                        className="group flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--cp-accent)] py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[var(--cp-accent-hover)] disabled:cursor-wait disabled:opacity-70"
                      >
                        {isSubscribing && <Loader2 className="size-4 animate-spin" />}
                        {isSubscribing ? 'Redirecting to checkout...' : 'Subscribe'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
