'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  CreditCard,
  FileText,
  HardDrive,
  MessageSquare,
  Palette,
  Shield,
  Sparkles,
  Star,
  Target,
  Users,
  Video,
  Zap,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

type Plan = 'free' | 'founding' | 'starter' | 'pro' | 'scale'
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

const BENEFITS = [
  { icon: Users, title: 'Unlimited Clients', description: 'Add as many clients as you need, no caps' },
  { icon: Video, title: 'Video Library (50 GB)', description: 'Import training videos from Google Drive' },
  { icon: CalendarDays, title: 'Schedule & Calendar', description: 'Book sessions, set availability, iCal sync' },
  { icon: MessageSquare, title: 'Messaging', description: 'Real-time chat + broadcast to all clients' },
  { icon: CreditCard, title: 'Payments & Invoicing', description: 'Track payments, send invoices, manage packages' },
  { icon: BookOpen, title: 'Programs', description: 'Create training programs with video modules' },
  { icon: BarChart3, title: 'Analytics', description: 'Revenue trends, client engagement, session stats' },
  { icon: Target, title: 'Goal Tracking', description: 'Set and track client goals + daily check-ins' },
  { icon: Palette, title: 'White-Label Branding', description: 'Custom colors, logo, branded client portal' },
  { icon: Star, title: 'Testimonials', description: 'Collect and display client testimonials' },
  { icon: FileText, title: 'Assignments', description: 'Send homework with file uploads' },
  { icon: Shield, title: 'Priority Support', description: 'Direct support from the ClearPath team' },
] as const

const FOUNDING_FEATURES = [
  'Unlimited clients',
  '50 GB video storage',
  'Client portal access',
  'Programs & assignments',
  'Invoicing & packages',
  'Real-time messaging + broadcast',
  'Schedule & calendar with iCal',
  'Analytics dashboard',
  'Google Drive video import',
  'White-label branding',
  'Goal tracking & check-ins',
  'Testimonial collection',
  'Priority support',
]

export function SubscriptionPageContent({
  subscription,
  hasStripeCustomer,
  clientCount,
}: SubscriptionPageContentProps) {
  const searchParams = useSearchParams()
  const success = searchParams.get('success') === 'true'
  const cancelled = searchParams.get('cancelled') === 'true'

  const [loadingPlan, setLoadingPlan] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  const currentPlan = subscription?.plan ?? 'free'
  const hasActiveSub = subscription && ['active', 'trialing'].includes(subscription.status)
  const storageGb = currentPlan === 'scale' ? 200 : currentPlan === 'starter' ? 10 : 50

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

  const statusBadgeVariant = (status: Status) => {
    if (status === 'active') return 'active'
    if (status === 'trialing') return 'pending'
    return 'error'
  }

  return (
    <main className="min-h-screen p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader title="Subscription" />

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

      {/* ── Current plan hero ── */}
      <Card variant="raised" padding="lg" className="relative overflow-hidden border-2 border-[var(--cp-accent)]">
        <div className="absolute right-0 top-0 h-32 w-32 -translate-y-1/3 translate-x-1/3 rounded-full bg-[var(--accent-light)] opacity-60" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="size-5 text-[var(--cp-accent)]" strokeWidth={2} aria-hidden />
              <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">
                {PLAN_LABELS[currentPlan]}
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
              {portalLoading ? 'Opening...' : 'Manage billing'}
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
              <span className="text-[15px] font-normal text-[var(--text-secondary)]"> / unlimited</span>
            </p>
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
          </div>
        </div>
      </Card>

      {/* ── Founding Member offer (show when not subscribed) ── */}
      {!hasActiveSub && (
        <Card
          variant="raised"
          padding="lg"
          className="relative overflow-hidden border-2 border-[var(--cp-accent)]/60"
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="rounded-full bg-[var(--cp-accent)] px-4 py-1 text-[11px] font-semibold text-white shadow">
              Founding Member
            </span>
          </div>

          <div className="mt-3 text-center">
            <div className="flex items-end justify-center gap-1">
              <span className="text-[40px] font-bold leading-none text-[var(--text-primary)]">$99</span>
              <span className="mb-1.5 text-[16px] text-[var(--text-secondary)]">/month</span>
            </div>
            <p className="mt-2 text-[14px] text-[var(--cp-accent)]">
              Locked-in rate for life. No setup fee.
            </p>
            <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">
              Only 10 founding spots available.
            </p>
          </div>

          <ul className="mx-auto mt-6 max-w-md space-y-2">
            {FOUNDING_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[14px] text-[var(--text-secondary)]">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--cp-accent)]" strokeWidth={2.5} aria-hidden />
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-6 text-center">
            <Button
              variant="primary"
              onClick={handleCheckout}
              disabled={loadingPlan}
              className="min-w-[200px]"
            >
              {loadingPlan ? (
                <span className="flex items-center gap-2">
                  <Zap className="size-4 animate-pulse" aria-hidden />
                  Redirecting...
                </span>
              ) : (
                'Get started — $99/month'
              )}
            </Button>
          </div>

          <p className="mt-3 text-center text-[12px] text-[var(--text-tertiary)]">
            Cancel anytime. Monthly price recurs each billing period.
          </p>
        </Card>
      )}

      {/* ── What's Included benefits grid ── */}
      <div>
        <p className="mb-3 text-[13px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
          What&apos;s Included
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, description }) => (
            <Card key={title} variant="glow" padding="default" className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-light)]">
                <Icon className="size-[18px] text-[var(--cp-accent)]" strokeWidth={1.5} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-tertiary)]">{description}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
