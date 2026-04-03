'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

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
    <div className="flex h-11 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3">
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${iconBgClass}`}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[var(--text-primary)]">{label}</p>
        <p className="truncate text-[14px] font-semibold text-[var(--text-primary)]">{value}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 shrink-0 px-2 text-[12px]"
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
    <div className="rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-light)] p-3">
      <Button type="button" variant="primary" className="w-full" disabled={loading} onClick={() => void pay()}>
        {loading ? 'Opening secure checkout…' : `Pay ${amountLabel} by card`}
      </Button>
      <p className="mt-2 text-[12px] text-[var(--text-secondary)]">Secure checkout with Stripe.</p>
      {error ? <p className="mt-2 text-[12px] text-[var(--error)]">{error}</p> : null}
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
  const [confirmOpen, setConfirmOpen] = useState(false)

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

  const sendPaymentNotice = async () => {
    setSending(true)
    try {
      const body = `I've sent payment for invoice #${invoiceId}`
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
      setToast("Message sent to your coach. They'll confirm once received.")
    } catch {
      setToast('Could not notify your coach — try again.')
    } finally {
      setSending(false)
      setConfirmOpen(false)
    }
  }

  return (
    <div className="mt-4 border-t border-[var(--border-default)] pt-4">
      <p className="text-[13px] font-semibold text-[var(--text-primary)]">Send payment to:</p>

      {!hasAny && !branding.instructions ? (
        <p className="mt-3 text-[14px] text-[var(--text-tertiary)]">Contact your coach for payment details.</p>
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
            <p className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-[13px] text-[var(--text-tertiary)]">
              Your coach is still finishing Stripe card payments. Use another method above or check Messages.
            </p>
          ) : null}
        </div>
      )}

      {branding.instructions ? (
        <div className="mt-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] px-3 py-3 text-[14px] italic text-[var(--text-secondary)]">
          📝 {branding.instructions}
        </div>
      ) : null}

      <div className="mt-4">
        <Button
          type="button"
          variant="secondary"
          className="h-11 w-full"
          disabled={sending}
          onClick={() => setConfirmOpen(true)}
        >
          I&apos;ve sent payment
        </Button>
      </div>

      <Modal isOpen={confirmOpen} onClose={() => !sending && setConfirmOpen(false)} title="Confirm payment">
        <p className="text-[14px] text-[var(--text-secondary)]">Have you already sent {amountLabel}?</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" disabled={sending} onClick={() => setConfirmOpen(false)}>
            Not yet
          </Button>
          <Button type="button" variant="primary" disabled={sending} onClick={() => void sendPaymentNotice()}>
            Yes, I sent it
          </Button>
        </div>
      </Modal>

      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-[60] max-w-sm -translate-x-1/2 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--text-primary)] px-4 py-2 text-center text-[14px] text-[var(--bg-app)] shadow-[var(--shadow-lg)]"
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
  const [paidOpen, setPaidOpen] = useState(true)

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
      <div className="mt-10 text-center">
        <p className="text-[2rem]" aria-hidden>
          💳
        </p>
        <p className="mt-4 text-[18px] font-semibold text-[var(--text-primary)]">No invoices yet</p>
        <p className="mt-2 text-[14px] text-[var(--text-tertiary)]">Invoices from your coach will appear here.</p>
      </div>
    )
  }

  const pending = invoices.filter((i) => i.status === 'pending')
  const paid = invoices.filter((i) => i.status !== 'pending')

  function InvoicePendingCard({ inv }: { inv: ClientInvoiceRow }) {
    return (
      <Card variant="default" padding="lg" className="border-l-4 border-l-[var(--warning)]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[24px] font-bold text-[var(--text-primary)]">{formatAmount(inv.amount_cents, inv.currency)}</p>
            <span className="mt-1 inline-flex rounded-full bg-[var(--warning-bg)] px-2 py-0.5 text-[12px] font-medium text-[var(--warning)]">
              Pending
            </span>
            <h2 className="mt-2 text-[14px] text-[var(--text-secondary)]">{inv.session_packages?.title ?? 'Invoice'}</h2>
            <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">
              Sent {format(new Date(inv.created_at), 'MMMM d, yyyy')}
            </p>
          </div>
        </div>
        {brandingLoaded ? (
          <HowToPayBlock
            clientId={clientId}
            invoiceId={inv.id}
            amountLabel={formatAmount(inv.amount_cents, inv.currency)}
            branding={branding}
          />
        ) : (
          <p className="mt-3 text-[13px] text-[var(--text-tertiary)]">Loading payment options…</p>
        )}
      </Card>
    )
  }

  return (
    <div className="mt-6 space-y-8">
      {pending.length > 0 ? (
        <section>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            Awaiting payment
          </p>
          <ul className="space-y-4">
            {pending.map((inv) => (
              <li key={inv.id}>
                <InvoicePendingCard inv={inv} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {paid.length > 0 ? (
        <section>
          <button
            type="button"
            onClick={() => setPaidOpen((v) => !v)}
            className="mb-3 flex w-full items-center justify-between text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]"
          >
            Paid
            <span aria-hidden>{paidOpen ? '▾' : '▸'}</span>
          </button>
          {paidOpen ? (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {paid.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-[13px]">
                  <span className="font-medium text-[var(--text-primary)]">
                    {inv.paid_at ? format(new Date(inv.paid_at), 'MMM d, yyyy') : format(new Date(inv.created_at), 'MMM d, yyyy')}
                  </span>
                  <span className="text-[var(--text-secondary)]">{formatAmount(inv.amount_cents, inv.currency)}</span>
                  <span className="rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--success)]">
                    Paid
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

export function ClientInvoicesBackLink() {
  return (
    <div className="mb-4">
      <Link href="/client/portal" className="text-[14px] font-medium text-[var(--accent)]">
        ← Back to home
      </Link>
    </div>
  )
}
