'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Loader2, AlertCircle, CheckCircle2, Ticket } from 'lucide-react'
import { formatCents } from '@/lib/format-currency'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

type AvailablePass = {
  id: string
  title: string
  description: string | null
  price_cents: number
  currency: string
  credit_count: number
  applies_to: 'all' | 'types'
  applies_to_types: string[] | null
  expires_in_days: number | null
}

type Balance = {
  id: string
  title: string
  credits_total: number
  credits_remaining: number
  expires_at: string | null
}

type ApiData = { passes: AvailablePass[]; balances: Balance[]; totalCredits: number }

function humanizeType(raw: string): string {
  return raw.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function PassesContent() {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [buyingId, setBuyingId] = useState<string | null>(null)
  const [buyError, setBuyError] = useState<string | null>(null)
  const [banner, setBanner] = useState<'purchased' | 'cancelled' | null>(null)
  const [balancePolling, setBalancePolling] = useState(false)
  const [balanceStale, setBalanceStale] = useState(false)
  const lastTotalRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/client/passes', { credentials: 'include' })
      const json = (await res.json().catch(() => ({}))) as { data?: ApiData; error?: string }
      if (!res.ok) {
        setFetchError(json.error ?? 'Could not load passes')
        return
      }
      setData(json.data ?? null)
      lastTotalRef.current = json.data?.totalCredits ?? null
    } catch {
      setFetchError('Network error — please refresh')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Quiet refetch (no full-page loading state). Returns the new total, or null on failure. */
  const refetchBalances = useCallback(async (): Promise<number | null> => {
    try {
      const res = await fetch('/api/client/passes', { credentials: 'include' })
      const json = (await res.json().catch(() => ({}))) as { data?: ApiData }
      if (res.ok && json.data) {
        setData(json.data)
        return json.data.totalCredits ?? 0
      }
    } catch {
      /* transient — poll loop just tries again */
    }
    return null
  }, [])

  // After a Stripe return the webhook that grants credits can lag the redirect, so the
  // success banner would sit above a stale balance. Poll briefly (every 2s, up to 6 tries),
  // stopping early as soon as the balance increases; offer a manual refresh if it never does.
  useEffect(() => {
    if (banner !== 'purchased') return
    let cancelled = false
    setBalanceStale(false)
    setBalancePolling(true)
    ;(async () => {
      let baseline = lastTotalRef.current
      for (let attempt = 0; attempt < 6; attempt++) {
        await new Promise((r) => setTimeout(r, 2000))
        if (cancelled) return
        const total = await refetchBalances()
        if (cancelled) return
        if (total == null) continue
        // Prefer the total seen by the initial page load as the baseline (it may have
        // completed during our first sleep); fall back to the first polled value.
        if (baseline == null) baseline = lastTotalRef.current ?? total
        if (total > baseline) {
          setBalancePolling(false)
          return
        }
      }
      if (!cancelled) {
        setBalancePolling(false)
        setBalanceStale(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [banner, refetchBalances])

  // Read ?purchased / ?cancelled from the Stripe return (client-only — avoids the
  // useSearchParams Suspense requirement), then clean the URL.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('purchased') === '1') setBanner('purchased')
    else if (p.get('cancelled') === '1') setBanner('cancelled')
    if (p.has('purchased') || p.has('cancelled')) {
      window.history.replaceState({}, '', '/client/passes')
    }
  }, [])

  async function handleBuy(passId: string) {
    setBuyError(null)
    setBuyingId(passId)
    try {
      const res = await fetch('/api/client/buy-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ passId }),
      })
      const json = (await res.json().catch(() => ({}))) as { data?: { url?: string }; error?: string }
      if (!res.ok) {
        setBuyError(json.error ?? 'Could not start checkout — please try again')
        setBuyingId(null)
        return
      }
      const url = json.data?.url
      if (url) {
        let parsed: URL | null = null
        try { parsed = new URL(url) } catch { /* invalid */ }
        if (parsed && parsed.protocol === 'https:' && parsed.hostname === 'checkout.stripe.com') {
          window.location.href = url
          return
        }
        setBuyError('Unexpected checkout URL — please contact support')
        setBuyingId(null)
        return
      }
      setBuyError('Checkout link missing — please try again')
      setBuyingId(null)
    } catch {
      setBuyError('Network error — please try again')
      setBuyingId(null)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-display text-[28px] font-medium tracking-tight text-[var(--text-primary)]">Passes</h1>
        </header>
        <Card className="p-10 text-center">
          <Loader2 className="mx-auto size-5 animate-spin text-[var(--text-tertiary)]" />
          <p className="mt-3 text-sm text-[var(--text-tertiary)]">Loading your passes...</p>
        </Card>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-display text-[28px] font-medium tracking-tight text-[var(--text-primary)]">Passes</h1>
        </header>
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{fetchError}</p>
        </div>
      </div>
    )
  }

  const { passes = [], balances = [], totalCredits = 0 } = data ?? {}
  const lowBalance = balances.length > 0 && totalCredits <= 2

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-[28px] font-medium tracking-tight text-[var(--text-primary)]">Passes</h1>
        <p className="text-sm text-[var(--text-tertiary)]">Buy class credits up front, then spend one each time you book.</p>
      </header>

      {banner === 'purchased' && (
        <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-xl border border-[var(--cp-accent)]/30 bg-[var(--cp-accent)]/10 px-4 py-3 text-sm text-[var(--cp-accent)]">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <p>Pass purchased — your credits are ready. They&rsquo;ll show below in a moment.</p>
            {balancePolling && (
              <p className="flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)]">
                <Loader2 className="size-3 animate-spin" /> Updating your balance…
              </p>
            )}
            {balanceStale && (
              <p className="flex items-center gap-2 text-[12px] text-[var(--text-tertiary)]">
                Still not seeing your credits?
                <button
                  type="button"
                  onClick={() => void refetchBalances()}
                  className="font-medium text-[var(--cp-accent)] underline-offset-2 hover:underline"
                >
                  Refresh
                </button>
              </p>
            )}
          </div>
        </div>
      )}
      {banner === 'cancelled' && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>Checkout cancelled — no charge was made.</p>
        </div>
      )}

      {/* Credits remaining — zero state (so the balance concept is always visible) */}
      {balances.length === 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Credits remaining</p>
            <p className="mt-1 font-display text-[32px] font-medium leading-none text-[var(--text-primary)]">0</p>
            <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">Buy a pass below to get started.</p>
            <Link href="/client/classes" className="mt-2 inline-block text-[13px] font-medium text-[var(--cp-accent)] underline-offset-2 hover:underline">
              Book a class →
            </Link>
          </div>
          <Ticket className="size-8 text-[var(--text-quaternary)]" />
        </div>
      )}

      {/* Your passes */}
      {balances.length > 0 && (
        <section className="space-y-3">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Credits remaining</p>
                <p className="mt-1 font-display text-[40px] font-medium leading-none text-[var(--text-primary)]">{totalCredits}</p>
              </div>
              <Ticket className="size-8 text-[var(--cp-accent)]" />
            </div>
            {lowBalance && (
              <p className="mt-3 text-[13px] font-medium text-[var(--cp-accent)]">Running low — grab another pass below so you don&rsquo;t miss a class.</p>
            )}
            <div className="mt-5 space-y-2">
              {balances.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--cp-offwhite)] px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{b.title}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {b.credits_remaining} of {b.credits_total} left
                      {b.expires_at ? ` · expires ${format(parseISO(b.expires_at), 'MMM d, yyyy')}` : ''}
                    </p>
                  </div>
                  <span className="font-display text-lg font-medium text-[var(--text-primary)] tabular-nums">{b.credits_remaining}</span>
                </div>
              ))}
            </div>
            <Link href="/client/classes" className="mt-4 inline-block text-[13px] font-medium text-[var(--cp-accent)] underline-offset-2 hover:underline">
              Book a class →
            </Link>
          </div>
        </section>
      )}

      {/* Buy a pass */}
      {buyError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{buyError}</p>
        </div>
      )}

      <section className="space-y-3">
        {balances.length > 0 && (
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-quaternary)]">Buy another pass</h2>
        )}
        {passes.length === 0 ? (
          balances.length === 0 ? (
            <EmptyState title="No passes yet" description="Your coach hasn't set up any passes yet. Check back soon." />
          ) : null
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {passes.map((pass) => {
              const isBuying = buyingId === pass.id
              return (
                <div key={pass.id} className="flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-6">
                  <h3 className="text-[18px] font-semibold text-[var(--text-primary)]">{pass.title}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="font-display text-[32px] font-medium text-[var(--text-primary)]">{formatCents(pass.price_cents)}</span>
                  </div>
                  <p className="mt-3 text-[14px] text-[var(--text-secondary)]">
                    {pass.credit_count} {pass.credit_count === 1 ? 'class' : 'classes'}
                    {pass.applies_to === 'all' ? ' · any class' : ''}
                  </p>
                  {pass.applies_to === 'types' && pass.applies_to_types && pass.applies_to_types.length > 0 && (
                    <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">For: {pass.applies_to_types.map(humanizeType).join(', ')}</p>
                  )}
                  {pass.expires_in_days != null && (
                    <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">Expires {pass.expires_in_days} days after purchase</p>
                  )}
                  <div className="mt-auto pt-5">
                    <button
                      type="button"
                      onClick={() => void handleBuy(pass.id)}
                      disabled={isBuying || buyingId !== null}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--cp-accent)] py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[var(--cp-accent-hover)] disabled:cursor-wait disabled:opacity-70"
                    >
                      {isBuying && <Loader2 className="size-4 animate-spin" />}
                      {isBuying ? 'Redirecting to checkout...' : 'Buy pass'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
