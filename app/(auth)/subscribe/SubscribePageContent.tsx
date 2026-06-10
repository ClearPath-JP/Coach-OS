'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

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

const TOTAL_FOUNDING_SPOTS = 10

interface Props {
  userEmail: string
  /** `?error=` code from the checkout/activation redirect (new-coach-activate route). */
  errorCode?: string | null
  /** `?cancelled=true` — the coach backed out of Stripe Checkout. */
  checkoutCancelled?: boolean
}

export function SubscribePageContent({ userEmail, errorCode = null, checkoutCancelled = false }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claimedSpots, setClaimedSpots] = useState<number | null>(null)

  // Fetch how many founding members have already subscribed
  useEffect(() => {
    let cancelled = false
    void fetch('/api/billing/founding-count', { credentials: 'include' })
      .then(async (r) => {
        if (!cancelled && r.ok) {
          const json = (await r.json().catch(() => ({}))) as { count?: number }
          if (typeof json.count === 'number') setClaimedSpots(json.count)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const spotsLeft = claimedSpots !== null ? Math.max(0, TOTAL_FOUNDING_SPOTS - claimedSpots) : null

  async function handleCheckout() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/billing/new-coach-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan: 'founding' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      const url = json.data?.url
      if (typeof url === 'string' && url) {
        router.push(url)
      } else {
        setError('Could not start checkout. Please try again.')
        setLoading(false)
      }
    } catch {
      setError('Something went wrong — check your connection and try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center bg-[var(--bg-app)] px-6 pb-20 pt-12">
      {/* Wordmark */}
      <div className="mb-12 text-center">
        <div className="font-display text-[22px] font-medium leading-none tracking-[0.12em] text-[var(--text-primary)]">
          KOR<span style={{ color: 'var(--accent)' }}>VA</span>
        </div>
        <p className="mt-1.5 text-[13px] text-[var(--text-tertiary)]">
          Built for coaches. Designed for growth.
        </p>
      </div>

      {/* Heading */}
      <div className="mb-10 max-w-[600px] text-center">
        <h1 className="font-display text-[clamp(26px,4vw,40px)] font-medium leading-[1.15] tracking-[0.01em] text-[var(--text-primary)]">
          Become a Founding Member
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-[var(--text-secondary)]">
          Lock in $99/month for life. No setup fee. Full platform access.
        </p>
        {userEmail && (
          <p className="mt-2 text-[13px] text-[var(--text-tertiary)]">
            Signing up as <strong className="font-semibold text-[var(--text-secondary)]">{userEmail}</strong>
          </p>
        )}
      </div>

      {/* Returned from a failed payment activation — guard against a double charge */}
      {errorCode && (
        <div
          role="alert"
          className="mb-8 w-full max-w-[480px] rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] px-5 py-4 text-left text-[14px] leading-relaxed text-[var(--warning)]"
        >
          <p className="font-semibold">We could not finish setting up your account.</p>
          <p className="mt-1">
            If you just completed payment, <strong>DO NOT pay again</strong> — sign in again
            and your account will finish setting up, or email{' '}
            <a href="mailto:hello@foundos.ai" className="font-semibold underline">
              hello@foundos.ai
            </a>
            .
          </p>
        </div>
      )}

      {/* Came back from a cancelled Stripe Checkout */}
      {checkoutCancelled && !errorCode && (
        <div
          role="status"
          className="mb-8 w-full max-w-[480px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-3 text-center text-[14px] text-[var(--text-secondary)]"
        >
          Checkout cancelled — you have not been charged.
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mb-8 max-w-[480px] rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-center text-[14px] text-[var(--error)]"
        >
          {error}
        </div>
      )}

      {/* Founding Member Card */}
      <div
        className="card-glow relative w-full max-w-[440px] rounded-2xl border-2 border-[var(--accent)] bg-[var(--bg-subtle)] px-8 py-10"
        style={{
          boxShadow: '0 0 40px rgba(200, 136, 46, 0.1), 0 0 80px rgba(200, 136, 46, 0.05)',
        }}
      >
        {/* Badge */}
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--accent)] px-3.5 py-1 text-[11px] font-bold tracking-[0.06em] text-white">
          Founding Member
        </div>

        {/* Price */}
        <div className="mb-2 text-center">
          <span className="text-[48px] font-extrabold leading-none tracking-[-0.04em] text-[var(--text-primary)]">
            $99
          </span>
          <span className="pb-1.5 text-[15px] font-medium text-[var(--text-secondary)]">/mo</span>
        </div>

        <p className="mb-1 text-center text-[14px] font-medium text-[var(--accent)]">
          Locked-in rate for life. No setup fee.
        </p>

        {/* Founding counter */}
        <div className="mb-7 text-center">
          {spotsLeft !== null ? (
            <div className="mt-3 flex flex-col items-center gap-2">
              <div className="flex w-full max-w-[200px] items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all duration-700"
                    style={{ width: `${((claimedSpots ?? 0) / TOTAL_FOUNDING_SPOTS) * 100}%` }}
                  />
                </div>
              </div>
              <p className={cn(
                'text-[13px] font-semibold',
                spotsLeft <= 3 ? 'text-[var(--error)]' : 'text-[var(--text-tertiary)]'
              )}>
                {spotsLeft === 0
                  ? 'All founding spots claimed!'
                  : `${spotsLeft} of ${TOTAL_FOUNDING_SPOTS} spots left`}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">
              Only {TOTAL_FOUNDING_SPOTS} founding spots available.
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="mb-6 h-px bg-[var(--border-default)]" />

        {/* Features */}
        <ul className="mb-8 flex flex-col gap-2.5">
          {FOUNDING_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[14px] leading-snug text-[var(--text-secondary)]">
              <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" strokeWidth={2.5} />
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          type="button"
          disabled={loading}
          onClick={handleCheckout}
          className={cn(
            'relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl',
            'bg-[var(--accent)] text-[15px] font-semibold text-white',
            'transition-all hover:bg-[var(--accent-hover)]',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Redirecting...
            </>
          ) : (
            'Get started — $99/month'
          )}
        </button>
      </div>

      {/* Footer note */}
      <p className="mt-10 text-center text-[13px] text-[var(--text-tertiary)]">
        No setup fees. Cancel anytime. Billed monthly.
      </p>
    </div>
  )
}
