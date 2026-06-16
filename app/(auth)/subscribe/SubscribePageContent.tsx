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
      <div className="mb-10 text-center">
        <div className="font-[family-name:var(--font-display)] text-[22px] font-extrabold leading-none tracking-[-0.02em] text-[var(--ink)]">
          Kor<span style={{ color: 'var(--belt-yellow)' }}>va</span>
        </div>
        <p className="mt-1.5 font-[family-name:var(--font-display)] text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          Built for coaches. Designed for growth.
        </p>
      </div>

      {/* Heading */}
      <div className="mb-9 max-w-[600px] text-center">
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(28px,4vw,42px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-[var(--ink)]">
          Become a Founding Member
        </h1>
        <p className="mt-4 text-[16px] font-medium leading-relaxed text-[var(--text-secondary)]">
          Start with a 14-day free trial. Then lock in $99/month for life — cancel anytime.
        </p>
        {userEmail && (
          <p className="mt-2 text-[13px] font-medium text-[var(--text-tertiary)]">
            Signing up as <strong className="font-bold text-[var(--ink)]">{userEmail}</strong>
          </p>
        )}
      </div>

      {/* Returned from a failed payment activation — guard against a double charge */}
      {errorCode && (
        <div
          role="alert"
          className="mb-8 w-full max-w-[480px] rounded-[14px] border-[3px] border-[var(--ink)] bg-[var(--belt-coral)] px-5 py-4 text-left text-[14px] leading-relaxed text-[var(--ink)] shadow-[4px_4px_0_var(--ink)]"
        >
          <p className="font-[family-name:var(--font-display)] font-extrabold">We could not finish setting up your account.</p>
          <p className="mt-1 font-medium">
            If you just completed payment, <strong className="font-extrabold">DO NOT pay again</strong> — sign in again
            and your account will finish setting up, or email{' '}
            <a href="mailto:hello@foundos.ai" className="font-extrabold underline underline-offset-2">
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
          className="mb-8 w-full max-w-[480px] rounded-[14px] border-[3px] border-[var(--ink)] bg-[var(--belt-teal)] px-4 py-3 text-center text-[14px] font-semibold text-[var(--ink)] shadow-[4px_4px_0_var(--ink)]"
        >
          Checkout cancelled — you have not been charged.
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mb-8 w-full max-w-[480px] rounded-[14px] border-[3px] border-[var(--ink)] bg-[var(--belt-coral)] px-4 py-3 text-center text-[14px] font-semibold text-[var(--ink)] shadow-[4px_4px_0_var(--ink)]"
        >
          {error}
        </div>
      )}

      {/* Founding Member Card — big belt-yellow brutal block */}
      <div className="relative w-full max-w-[440px] rounded-[20px] border-[3px] border-[var(--ink)] bg-[var(--belt-yellow)] px-8 py-10 shadow-[8px_8px_0_var(--ink)]">
        {/* Badge */}
        <div className="arcade-badge arcade-badge-dark absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
          ⭐ Founding Member
        </div>

        {/* Price */}
        <div className="mb-2 text-center">
          <span className="font-[family-name:var(--font-display)] text-[52px] font-extrabold leading-none tracking-[-0.04em] text-[var(--ink)]">
            $99
          </span>
          <span className="pb-1.5 font-[family-name:var(--font-display)] text-[16px] font-bold text-[var(--ink)]/70">/mo</span>
        </div>

        <p className="mb-1 text-center font-[family-name:var(--font-display)] text-[14px] font-bold text-[var(--ink)]">
          14 days free, then $99/mo for life. $0 due today.
        </p>

        {/* Founding counter */}
        <div className="mb-7 text-center">
          {spotsLeft !== null ? (
            <div className="mt-3 flex flex-col items-center gap-2">
              <div className="flex w-full max-w-[220px] items-center gap-2">
                <div className="h-3.5 flex-1 overflow-hidden rounded-full border-2 border-[var(--ink)] bg-white">
                  <div
                    className="h-full bg-[var(--belt-coral)] transition-all duration-700"
                    style={{ width: `${((claimedSpots ?? 0) / TOTAL_FOUNDING_SPOTS) * 100}%` }}
                  />
                </div>
              </div>
              <p className={cn(
                'font-[family-name:var(--font-display)] text-[13px] font-bold',
                'text-[var(--ink)]'
              )}>
                {spotsLeft === 0
                  ? 'All founding spots claimed!'
                  : `${spotsLeft} of ${TOTAL_FOUNDING_SPOTS} spots left`}
              </p>
            </div>
          ) : (
            <p className="mt-1 font-[family-name:var(--font-display)] text-[12px] font-semibold text-[var(--ink)]/70">
              Only {TOTAL_FOUNDING_SPOTS} founding spots available.
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="mb-6 h-0.5 bg-[var(--ink)]/20" />

        {/* Features */}
        <ul className="mb-8 flex flex-col gap-2.5">
          {FOUNDING_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[14px] font-medium leading-snug text-[var(--ink)]">
              <span className="mt-0.5 grid size-5 shrink-0 place-content-center rounded-[6px] border-2 border-[var(--ink)] bg-white">
                <Check className="size-3 text-[var(--ink)]" strokeWidth={3} />
              </span>
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
            'relative flex h-12 w-full items-center justify-center gap-2 rounded-[12px]',
            'border-[3px] border-[var(--ink)] bg-[var(--belt-blue)] font-[family-name:var(--font-display)] text-[15px] font-extrabold tracking-[-0.01em] text-[var(--ink)]',
            'shadow-[4px_4px_0_var(--ink)] transition-all',
            'hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_var(--ink)]',
            'active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
            'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_var(--ink)]'
          )}
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Redirecting...
            </>
          ) : (
            'Start my 14-day free trial'
          )}
        </button>
      </div>

      {/* Auto-renewal disclosure — required adjacent to the pay button */}
      <p className="mt-8 max-w-[440px] text-center text-[13px] font-medium leading-relaxed text-[var(--text-tertiary)]">
        Your card is saved today but{' '}
        <strong className="font-bold text-[var(--ink)]">not charged for 14 days</strong>. After your free trial it
        renews automatically at <strong className="font-bold text-[var(--ink)]">$99/month</strong> until you cancel —
        cancel anytime from Billing.
      </p>

      {/* Legal links */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px] font-semibold text-[var(--text-tertiary)]">
        <a href="/terms" className="hover:text-[var(--ink)] hover:underline">Terms</a>
        <a href="/privacy" className="hover:text-[var(--ink)] hover:underline">Privacy</a>
        <a href="/refunds" className="hover:text-[var(--ink)] hover:underline">Refunds</a>
      </div>
    </div>
  )
}
