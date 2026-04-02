'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type PackageRow = { id: string; title: string | null; description: string | null }
export type ClientInvoiceRow = {
  id: string
  amount_cents: number
  currency: string
  status: string
  due_date: string | null
  paid_at: string | null
  created_at: string
  session_packages: PackageRow | null
}

type BrandingData = {
  cashappUsername?: string | null
  venmoUsername?: string | null
  paypalEmail?: string | null
  zelleEmailOrPhone?: string | null
  paymentInstructions?: string | null
  stripeConnected?: boolean | null
  stripeCardPaymentsEnabled?: boolean | null
  cashapp_username?: string | null
  venmo_username?: string | null
  paypal_email?: string | null
  zelle_email_or_phone?: string | null
  payment_instructions?: string | null
  stripe_connected?: boolean | null
  stripe_card_payments_enabled?: boolean | null
}

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase() === 'USD' ? 'USD' : currency,
  }).format(cents / 100)
}

function pickBranding(b: BrandingData | null) {
  if (!b) return null
  return {
    cashapp: (b.cashapp_username ?? b.cashappUsername)?.trim() || '',
    venmo: (b.venmo_username ?? b.venmoUsername)?.trim() || '',
    paypal: (b.paypal_email ?? b.paypalEmail)?.trim() || '',
    zelle: (b.zelle_email_or_phone ?? b.zelleEmailOrPhone)?.trim() || '',
    instructions: (b.payment_instructions ?? b.paymentInstructions)?.trim() || '',
    stripe: Boolean(b.stripe_connected ?? b.stripeConnected),
    stripeCard: Boolean(b.stripe_card_payments_enabled ?? b.stripeCardPaymentsEnabled),
  }
}

function PaymentMethodRow({
  icon,
  label,
  value,
  copyKey,
  copiedKey,
  onCopy,
  iconBgClass,
}: {
  icon: ReactNode
  label: string
  value: string
  copyKey: string
  copiedKey: string | null
  onCopy: (key: string, text: string) => void
  iconBgClass: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${iconBgClass}`}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-[var(--color-ink)]">
          {label}: <span className="font-medium">{value}</span>
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        className="shrink-0 text-[13px]"
        onClick={() => onCopy(copyKey, value)}
      >
        {copiedKey === copyKey ? 'Copied!' : 'Copy'}
      </Button>
    </div>
  )
}

function StripeInvoicePayButton({ invoiceId, amountLabel }: { invoiceId: string; amountLabel: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pay = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/checkout`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        data?: { url?: string; checkoutUrl?: string }
      }
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not start checkout')
        return
      }
      const url = json.data?.checkoutUrl ?? json.data?.url
      if (typeof url === 'string' && url.length > 0) {
        window.location.href = url
        return
      }
      setError('Checkout did not return a link')
    } catch {
      setError('Something went wrong — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
      <Button type="button" className="w-full bg-indigo-600 text-white hover:bg-indigo-700" disabled={loading} onClick={() => void pay()}>
        {loading ? 'Opening secure checkout…' : `Pay ${amountLabel} by card`}
      </Button>
      <p className="mt-2 text-[12px] text-indigo-800">Secure checkout with Stripe.</p>
      {error ? <p className="mt-2 text-[12px] text-red-700">{error}</p> : null}
    </div>
  )
}

function HowToPayBlock({
  clientId,
  invoiceId,
  amountLabel,
  branding,
}: {
  clientId: string
  invoiceId: string
  amountLabel: string
  branding: NonNullable<ReturnType<typeof pickBranding>>
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const onCopy = (key: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey(null), 2000)
    })
  }

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(t)
  }, [toast])

  const hasAny =
    branding.cashapp ||
    branding.venmo ||
    branding.paypal ||
    branding.zelle ||
    branding.stripeCard ||
    branding.stripe

  const handleSentPayment = async () => {
    setSending(true)
    try {
      const body = `I've sent payment for invoice ${invoiceId}`
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ clientId, content: body, messageType: 'text' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast(typeof json.error === 'string' ? json.error : 'Could not notify your coach — try Messages.')
        return
      }
      setToast('Your coach has been notified.')
    } catch {
      setToast('Could not notify your coach — try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mt-4 border-t border-[var(--color-border)] pt-4">
      <p className="text-[15px] font-medium text-[var(--color-ink)]">How to pay {amountLabel}:</p>

      {!hasAny && !branding.instructions ? (
        <p className="mt-3 text-[14px] text-[var(--color-muted)]">Contact your coach for payment details.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {branding.cashapp ? (
            <PaymentMethodRow
              icon={<span>$</span>}
              label="CashApp"
              value={branding.cashapp}
              copyKey={`ca-${invoiceId}`}
              copiedKey={copiedKey}
              onCopy={onCopy}
              iconBgClass="bg-emerald-600"
            />
          ) : null}
          {branding.venmo ? (
            <PaymentMethodRow
              icon={<span>V</span>}
              label="Venmo"
              value={branding.venmo}
              copyKey={`vm-${invoiceId}`}
              copiedKey={copiedKey}
              onCopy={onCopy}
              iconBgClass="bg-sky-600"
            />
          ) : null}
          {branding.paypal ? (
            <PaymentMethodRow
              icon={<span>P</span>}
              label="PayPal"
              value={branding.paypal}
              copyKey={`pp-${invoiceId}`}
              copiedKey={copiedKey}
              onCopy={onCopy}
              iconBgClass="bg-blue-700"
            />
          ) : null}
          {branding.zelle ? (
            <PaymentMethodRow
              icon={<span>Z</span>}
              label="Zelle"
              value={branding.zelle}
              copyKey={`zl-${invoiceId}`}
              copiedKey={copiedKey}
              onCopy={onCopy}
              iconBgClass="bg-violet-600"
            />
          ) : null}
          {branding.stripeCard ? <StripeInvoicePayButton invoiceId={invoiceId} amountLabel={amountLabel} /> : null}
          {!branding.stripeCard && branding.stripe ? (
            <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-muted)]">
              Your coach is still finishing Stripe card payments. Use another method above or check Messages.
            </p>
          ) : null}
        </div>
      )}

      {branding.instructions ? (
        <p
          className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 italic text-[var(--color-muted)]"
          style={{ fontSize: '12px' }}
        >
          📝 {branding.instructions}
        </p>
      ) : null}

      <div className="mt-4">
        <Button type="button" className="w-full sm:w-auto" disabled={sending} onClick={() => void handleSentPayment()}>
          {sending ? 'Sending…' : "I've sent payment"}
        </Button>
      </div>

      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-[60] max-w-sm -translate-x-1/2 rounded-lg border border-[var(--color-border)] bg-[var(--color-ink)] px-4 py-2 text-center text-[14px] text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </div>
  )
}

const EMPTY_BRANDING = {
  cashapp: '',
  venmo: '',
  paypal: '',
  zelle: '',
  instructions: '',
  stripe: false,
  stripeCard: false,
}

export function ClientInvoicesList({ clientId, invoices }: { clientId: string; invoices: ClientInvoiceRow[] }) {
  const [brandingRaw, setBrandingRaw] = useState<BrandingData | null>(null)
  const [brandingLoaded, setBrandingLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/client/workspace-branding', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j?.data) setBrandingRaw(j.data as BrandingData)
      })
      .catch(() => {
        if (!cancelled) setBrandingRaw(null)
      })
      .finally(() => {
        if (!cancelled) setBrandingLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const branding = pickBranding(brandingRaw) ?? EMPTY_BRANDING

  if (invoices.length === 0) {
    return (
      <Card variant="raised" padding="lg" className="mt-6 text-center">
        <p className="font-medium text-[var(--color-ink)]">No invoices yet</p>
        <p className="mt-1 text-[15px] text-[var(--color-muted)]">
          When your coach sends you an invoice, it will appear here and in Messages.
        </p>
      </Card>
    )
  }

  return (
    <ul className="mt-6 space-y-4">
      {invoices.map((inv) => (
        <li key={inv.id}>
          <Card variant="raised" padding="lg">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-medium text-[var(--color-ink)]">
                  {inv.session_packages?.title ?? 'Invoice'}
                </h2>
                <p className="mt-1 text-[15px] text-[var(--color-muted)]">
                  {formatAmount(inv.amount_cents, inv.currency)}
                </p>
                {inv.due_date && inv.status === 'pending' && (
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Due {format(new Date(inv.due_date), 'MMM d, yyyy')}
                  </p>
                )}
                {inv.paid_at && (
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Paid {format(new Date(inv.paid_at), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[13px] font-medium ${
                  inv.status === 'paid'
                    ? 'bg-[var(--color-success-light)] text-[var(--color-success)]'
                    : inv.status === 'cancelled' || inv.status === 'refunded'
                      ? 'bg-[var(--color-border)]/80 text-[var(--color-muted)]'
                      : 'bg-[var(--color-warning-light)] text-[var(--color-warning)]'
                }`}
              >
                {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
              </span>
            </div>
            {inv.status === 'pending' && brandingLoaded ? (
              <HowToPayBlock
                clientId={clientId}
                invoiceId={inv.id}
                amountLabel={formatAmount(inv.amount_cents, inv.currency)}
                branding={branding}
              />
            ) : null}
            {inv.status === 'pending' && !brandingLoaded ? (
              <p className="mt-3 text-[13px] text-[var(--color-muted)]">Loading payment options…</p>
            ) : null}
          </Card>
        </li>
      ))}
    </ul>
  )
}

export function ClientInvoicesBackLink() {
  return (
    <div className="mb-4">
      <Link
        href="/client/portal"
        className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]"
      >
        ← Back to portal
      </Link>
    </div>
  )
}
