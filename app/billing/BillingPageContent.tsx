'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, Zap } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { format } from 'date-fns'

type Plan = 'free' | 'founding' | 'starter' | 'pro' | 'scale'
type Status = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused'

export interface BillingPageContentProps {
  subscription: {
    plan: Plan
    status: Status
    current_period_end: string | null
    trial_ends_at: string | null
  } | null
  hasStripeCustomer: boolean
}

const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free Trial',
  founding: 'Founding Member',
  starter: 'Starter',
  pro: 'Pro',
  scale: 'Scale',
}

const STATUS_LABELS: Record<Status, string> = {
  trialing: 'Trial',
  active: 'Active',
  past_due: 'Past due',
  cancelled: 'Cancelled',
  paused: 'Paused',
}

const FOUNDING_FEATURES = [
  'Unlimited clients',
  '50 GB video storage',
  'Programs & assignments',
  'Invoicing & packages',
  'Client portal',
  'Real-time messaging + broadcast',
  'Schedule & calendar with iCal',
  'Analytics dashboard',
  'White-label branding',
  'Google Drive integration',
  'Priority support',
]

export function BillingPageContent({ subscription, hasStripeCustomer }: BillingPageContentProps) {
  const searchParams = useSearchParams()
  const success = searchParams.get('success') === 'true'
  const cancelled = searchParams.get('cancelled') === 'true'
  const warningPastDue = searchParams.get('warning') === 'past_due'
  const warningCancelled = searchParams.get('warning') === 'cancelled'
  const warningSubscription = searchParams.get('warning') === 'subscription'
  const warningTrialExpired = searchParams.get('warning') === 'trial_expired'

  const [loadingPlan, setLoadingPlan] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  const currentPlan = subscription?.plan ?? 'free'
  const hasActiveSub = subscription && ['active', 'trialing'].includes(subscription.status)

  const handleCheckout = async () => {
    setLoadingPlan(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'founding' }),
      })
      const json = await res.json()
      if (res.ok && json.data?.url) {
        window.location.href = json.data.url
        return
      }
      alert(json.error ?? 'Could not start checkout')
    } catch {
      alert('Something went wrong — try again')
    } finally {
      setLoadingPlan(false)
    }
  }

  const handlePortal = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const json = await res.json()
      if (res.ok && json.data?.url) {
        window.location.href = json.data.url
        return
      }
      alert(json.error ?? 'Could not open billing portal')
    } catch {
      alert('Something went wrong — try again')
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <main className="min-h-screen p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader title="Billing" />

      {success && (
        <div className="rounded-xl border border-[var(--color-success)] bg-[var(--color-success-light)] px-4 py-3 text-[15px] text-[var(--color-success)]">
          Your subscription is active. Welcome to ClearPath!
        </div>
      )}
      {cancelled && (
        <div className="rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-4 py-3 text-[15px] text-[var(--color-warning)]">
          Checkout cancelled. Your plan was not changed.
        </div>
      )}
      {warningTrialExpired && (
        <div className="rounded-xl border border-[var(--color-error)] bg-[var(--color-error-light)] px-4 py-3 text-[15px] text-[var(--color-error)]">
          Your free trial has expired. Subscribe to keep access to your coaching workspace.
        </div>
      )}
      {warningPastDue && (
        <div className="rounded-xl border border-[var(--color-error)] bg-[var(--color-error-light)] px-4 py-3 text-[15px] text-[var(--color-error)]">
          Payment failed — update your payment method to keep access.
        </div>
      )}
      {warningCancelled && (
        <div className="rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-4 py-3 text-[15px] text-[var(--color-warning)]">
          Your plan was cancelled. Renew to keep access.
        </div>
      )}
      {warningSubscription && !warningPastDue && !warningCancelled && (
        <div className="rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-light)] px-4 py-3 text-[15px] text-[var(--color-warning)]">
          Your subscription needs attention — choose a plan to restore full coach access.
        </div>
      )}

      {/* Current plan card */}
      <Card variant="raised" padding="lg" className={hasActiveSub ? 'border-2 border-[var(--color-accent)]' : ''}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="active" className="capitalize">{PLAN_LABELS[currentPlan]}</Badge>
          <Badge
            variant={
              subscription?.status === 'past_due' ? 'error' :
              subscription?.status === 'cancelled' ? 'pending' :
              subscription?.status === 'trialing' ? 'pending' : 'active'
            }
          >
            {subscription ? STATUS_LABELS[subscription.status] : 'Free Trial'}
          </Badge>
        </div>
        {subscription?.status === 'trialing' && subscription.trial_ends_at && (
          <p className="mt-2 text-[15px] text-[var(--color-text-secondary)]">
            Your trial ends {format(new Date(subscription.trial_ends_at), 'MMMM d, yyyy')}.
          </p>
        )}
        {subscription?.status === 'active' && subscription.current_period_end && (
          <p className="mt-2 text-[15px] text-[var(--color-text-secondary)]">
            Next billing date {format(new Date(subscription.current_period_end), 'MMMM d, yyyy')}.
          </p>
        )}
      </Card>

      {/* Founding Member offer */}
      {!hasActiveSub && (
        <Card variant="raised" padding="lg" className="relative overflow-hidden border-2 border-[var(--cp-accent)]/60">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="rounded-full bg-[var(--cp-accent)] px-4 py-1 text-[11px] font-semibold text-white shadow">
              Founding Member
            </span>
          </div>

          <div className="mt-3 text-center">
            <div className="flex items-end justify-center gap-1">
              <span className="text-[36px] font-bold leading-none text-[var(--text-primary)]">$99</span>
              <span className="mb-1 text-[15px] text-[var(--text-secondary)]">/month</span>
            </div>
            <p className="mt-2 text-[14px] text-[var(--cp-accent)]">
              Locked-in rate for life. No setup fee.
            </p>
          </div>

          <ul className="mx-auto mt-5 max-w-sm space-y-2">
            {FOUNDING_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[14px] text-[var(--text-secondary)]">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--cp-accent)]" strokeWidth={2.5} aria-hidden />
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-5 text-center">
            <Button variant="primary" onClick={handleCheckout} disabled={loadingPlan} className="min-w-[200px]">
              {loadingPlan ? (
                <span className="flex items-center gap-2">
                  <Zap className="size-4 animate-pulse" aria-hidden />
                  Redirecting...
                </span>
              ) : (
                'Subscribe — $99/month'
              )}
            </Button>
          </div>
          <p className="mt-3 text-center text-[12px] text-[var(--text-tertiary)]">
            Cancel anytime. Only 10 founding spots available.
          </p>
        </Card>
      )}

      {hasStripeCustomer && (
        <Card variant="flat" padding="default">
          <Button variant="secondary" onClick={handlePortal} disabled={portalLoading}>
            {portalLoading ? 'Opening...' : 'Manage billing'}
          </Button>
          <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
            Update payment method, view invoices, or change plan in Stripe.
          </p>
        </Card>
      )}
    </main>
  )
}
