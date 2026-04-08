'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Check, Sparkles, Users, HardDrive, Zap } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

type Plan = 'free' | 'starter' | 'pro' | 'scale'
type Status = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused'

export interface SubscriptionPageContentProps {
  subscription: {
    plan: Plan
    status: Status
    current_period_end: string | null
    trial_ends_at: string | null
  } | null
  hasStripeCustomer: boolean
  clientCount: number
}

const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
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

const PLAN_MAX_CLIENTS: Record<Plan, number | null> = {
  free: 3,
  starter: 10,
  pro: 30,
  scale: null,
}

const PLAN_STORAGE_GB: Record<Plan, number> = {
  free: 1,
  starter: 10,
  pro: 50,
  scale: 200,
}

const PRICING_TIERS = [
  {
    plan: 'starter' as const,
    price: '$49',
    period: '/mo',
    setupFee: '$197',
    popular: false,
    color: 'var(--text-primary)',
    features: [
      'Up to 10 clients',
      '10 GB video storage',
      'Programs & assignments',
      'Invoicing & packages',
      'Email support',
    ],
  },
  {
    plan: 'pro' as const,
    price: '$99',
    period: '/mo',
    setupFee: '$297',
    popular: true,
    color: 'var(--cp-accent)',
    features: [
      'Up to 30 clients',
      '50 GB video storage',
      'Everything in Starter',
      'Analytics dashboard',
      'White-label branding',
      'Priority support',
    ],
  },
  {
    plan: 'scale' as const,
    price: '$149',
    period: '/mo',
    setupFee: '$397',
    popular: false,
    color: 'var(--text-primary)',
    features: [
      'Unlimited clients',
      '200 GB video storage',
      'Everything in Pro',
      'Dedicated support',
      'API access (coming soon)',
    ],
  },
]

export function SubscriptionPageContent({
  subscription,
  hasStripeCustomer,
  clientCount,
}: SubscriptionPageContentProps) {
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  const currentPlan = subscription?.plan ?? 'free'
  const maxClients = PLAN_MAX_CLIENTS[currentPlan]
  const storageGb = PLAN_STORAGE_GB[currentPlan]
  const clientPercent = maxClients ? Math.min(100, (clientCount / maxClients) * 100) : 0

  const planOrder: Plan[] = ['starter', 'pro', 'scale']
  const currentIndex = planOrder.indexOf(currentPlan)

  const handleCheckout = async (plan: 'starter' | 'pro' | 'scale') => {
    setLoadingPlan(plan)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
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
      setLoadingPlan(null)
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

  const statusBadgeVariant = (status: Status) => {
    if (status === 'active') return 'active'
    if (status === 'trialing') return 'pending'
    return 'error'
  }

  return (
    <main className="min-h-screen p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader title="Subscription" />

      {/* ── Current plan hero ── */}
      <Card variant="raised" padding="lg" className="relative overflow-hidden border-2 border-[var(--cp-accent)]">
        <div className="absolute right-0 top-0 h-32 w-32 -translate-y-1/3 translate-x-1/3 rounded-full bg-[var(--accent-light)] opacity-60" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="size-5 text-[var(--cp-accent)]" strokeWidth={2} aria-hidden />
              <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
                {PLAN_LABELS[currentPlan]} Plan
              </h2>
              {subscription && (
                <Badge variant={statusBadgeVariant(subscription.status)}>
                  {STATUS_LABELS[subscription.status]}
                </Badge>
              )}
            </div>
            {subscription?.status === 'trialing' && subscription.trial_ends_at && (
              <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
                Trial ends {format(new Date(subscription.trial_ends_at), 'MMMM d, yyyy')}
              </p>
            )}
            {subscription?.status === 'active' && subscription.current_period_end && (
              <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
                Renews {format(new Date(subscription.current_period_end), 'MMMM d, yyyy')}
              </p>
            )}
            {subscription?.status === 'past_due' && (
              <p className="mt-1 text-[14px] text-[var(--error)]">
                Payment failed — update your payment method to keep access.
              </p>
            )}
          </div>
          {hasStripeCustomer && (
            <Button variant="secondary" onClick={handlePortal} disabled={portalLoading}>
              {portalLoading ? 'Opening…' : 'Manage billing'}
            </Button>
          )}
        </div>

        {/* Usage stats */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-[var(--bg-subtle)] p-4">
            <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
              <Users className="size-4 shrink-0" aria-hidden />
              <span>Clients</span>
            </div>
            <p className="mt-1 text-[22px] font-semibold text-[var(--text-primary)]">
              {clientCount}
              <span className="text-[15px] font-normal text-[var(--text-secondary)]">
                {' '}/ {maxClients ?? '∞'}
              </span>
            </p>
            {maxClients && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-default)]">
                <div
                  className="h-full rounded-full bg-[var(--cp-accent)] transition-all"
                  style={{ width: `${clientPercent}%` }}
                />
              </div>
            )}
          </div>
          <div className="rounded-xl bg-[var(--bg-subtle)] p-4">
            <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
              <HardDrive className="size-4 shrink-0" aria-hidden />
              <span>Video storage</span>
            </div>
            <p className="mt-1 text-[22px] font-semibold text-[var(--text-primary)]">
              {storageGb} GB
              <span className="text-[15px] font-normal text-[var(--text-secondary)]"> included</span>
            </p>
            <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">
              Plus {currentPlan === 'free' ? '0.5' : currentPlan === 'starter' ? '5' : currentPlan === 'pro' ? '20' : '100'} GB for assignment files
            </p>
          </div>
        </div>
      </Card>

      {/* ── 3 plan cards ── */}
      <div>
        <p className="mb-3 text-[13px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
          Available Plans
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {PRICING_TIERS.map(({ plan, price, period, setupFee, popular, features }) => {
            const isCurrent = currentPlan === plan
            const planIndex = planOrder.indexOf(plan)
            const isUpgrade = planIndex > currentIndex
            const isDowngrade = planIndex < currentIndex && currentPlan !== 'free'
            const buttonLabel = isCurrent
              ? 'Current plan'
              : isUpgrade
                ? 'Upgrade'
                : isDowngrade
                  ? 'Downgrade'
                  : 'Get started'

            return (
              <Card
                key={plan}
                variant="raised"
                padding="lg"
                className={[
                  'relative flex flex-col transition-shadow',
                  isCurrent
                    ? 'border-2 border-[var(--cp-accent)] shadow-md'
                    : popular
                      ? 'border-2 border-[var(--cp-accent)]/40'
                      : 'border border-[var(--border-default)]',
                ].join(' ')}
              >
                {popular && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-[var(--cp-accent)] px-3 py-0.5 text-[11px] font-semibold text-white shadow">
                      Most popular
                    </span>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-[var(--cp-accent)] px-3 py-0.5 text-[11px] font-semibold text-white shadow">
                      Your plan
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                    {PLAN_LABELS[plan]}
                  </p>
                  <div className="mt-1 flex items-end gap-1">
                    <span className="text-[30px] font-bold leading-none text-[var(--text-primary)]">
                      {price}
                    </span>
                    <span className="mb-1 text-[14px] text-[var(--text-secondary)]">{period}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">
                    {setupFee} one-time setup
                  </p>
                </div>

                <ul className="flex-1 space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[14px] text-[var(--text-secondary)]">
                      <Check className="mt-0.5 size-4 shrink-0 text-[var(--cp-accent)]" strokeWidth={2.5} aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-5">
                  <Button
                    variant={isCurrent ? 'secondary' : 'primary'}
                    fullWidth
                    disabled={isCurrent || loadingPlan !== null}
                    onClick={() =>
                      !isCurrent &&
                      (plan === 'starter' || plan === 'pro' || plan === 'scale') &&
                      handleCheckout(plan)
                    }
                  >
                    {loadingPlan === plan ? (
                      <span className="flex items-center gap-2">
                        <Zap className="size-4 animate-pulse" aria-hidden />
                        Redirecting…
                      </span>
                    ) : (
                      buttonLabel
                    )}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
        <p className="mt-3 text-center text-[12px] text-[var(--text-tertiary)]">
          One-time setup fee charged at checkout with your first invoice. Monthly price recurs each billing period.
        </p>
      </div>
    </main>
  )
}
