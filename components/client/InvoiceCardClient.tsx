'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { format } from 'date-fns'
import { useMemo, useState } from 'react'

export type InvoiceCardDataClient = {
  type: 'invoice'
  invoiceId: string
  clientId?: string
  packageTitle: string
  packageDescription?: string | null
  amountCents: number
  currency: string
  status: string
  dueDate?: string | null
  paidAt?: string | null
}

export type InvoicePaymentDetails = {
  stripeConnected?: boolean
  /** Coach finished Connect + charges enabled — safe to show Pay by card */
  stripeCardPaymentsEnabled?: boolean
  cashappUsername?: string | null
  venmoUsername?: string | null
  paypalEmail?: string | null
  zelleEmailOrPhone?: string | null
  paymentInstructions?: string | null
}

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase() === 'USD' ? 'USD' : currency,
  }).format(cents / 100)
}

export function InvoiceCardClient({
  data,
  paymentDetails,
}: {
  data: InvoiceCardDataClient
  paymentDetails?: InvoicePaymentDetails
}) {
  const isPaid = data.status === 'paid'
  const isCancelled = data.status === 'cancelled'
  const [selectedMethod, setSelectedMethod] = useState<string>('card')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const canPayByCard = paymentDetails?.stripeCardPaymentsEnabled === true

  const methods = useMemo(
    () =>
      [
        { key: 'cashapp', label: 'CashApp', value: paymentDetails?.cashappUsername ?? null, icon: '$', iconClass: 'bg-green-100 text-green-700' },
        { key: 'venmo', label: 'Venmo', value: paymentDetails?.venmoUsername ?? null, icon: 'V', iconClass: 'bg-sky-100 text-sky-700' },
        { key: 'paypal', label: 'PayPal', value: paymentDetails?.paypalEmail ?? null, icon: 'P', iconClass: 'bg-blue-100 text-blue-700' },
        { key: 'zelle', label: 'Zelle', value: paymentDetails?.zelleEmailOrPhone ?? null, icon: 'Z', iconClass: 'bg-violet-100 text-violet-700' },
      ].filter((m) => Boolean(m.value?.trim())),
    [paymentDetails]
  )

  const copyToClipboard = async (methodKey: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setSelectedMethod(methodKey)
    } catch {
      /* no-op */
    }
  }

  const startCardCheckout = async () => {
    if (!data.invoiceId || !data.clientId) return
    setCheckoutLoading(true)
    setCheckoutError(null)
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(data.invoiceId)}/checkout`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        data?: { url?: string; checkoutUrl?: string }
      }
      if (!res.ok) {
        setCheckoutError(typeof json.error === 'string' ? json.error : 'Could not start checkout')
        return
      }
      const url = json.data?.checkoutUrl ?? json.data?.url
      if (typeof url === 'string' && url.length > 0) {
        window.location.href = url
        return
      }
      setCheckoutError('Checkout did not return a link — try again')
    } catch {
      setCheckoutError('Something went wrong — try again')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const sendPaymentConfirmation = async () => {
    if (!data.clientId) return
    const ok = window.confirm('Have you already sent the payment?')
    if (!ok) return
    const labelMap: Record<string, string> = {
      card: 'card',
      cashapp: 'CashApp',
      venmo: 'Venmo',
      paypal: 'PayPal',
      zelle: 'Zelle',
    }
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: data.clientId,
        content: `Hi, I've sent payment via ${labelMap[selectedMethod] ?? 'a payment method'}`,
      }),
    }).catch(() => null)
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 min-w-[260px] max-w-[320px]">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-[var(--color-ink)]">{data.packageTitle}</h4>
        <Badge
          variant={
            isPaid ? 'active' : isCancelled ? 'inactive' : 'pending'
          }
        >
          {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
        </Badge>
      </div>
      {data.packageDescription && (
        <p className="mt-1 text-sm text-[var(--color-muted)] line-clamp-2">
          {data.packageDescription}
        </p>
      )}
      <p className="mt-2 text-lg font-medium text-[var(--color-ink)]">
        {formatAmount(data.amountCents, data.currency)}
      </p>
      {data.dueDate && !isPaid && !isCancelled && (
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Due {format(new Date(data.dueDate), 'MMM d, yyyy')}
        </p>
      )}
      {isPaid && data.paidAt && (
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Paid · {format(new Date(data.paidAt), 'MMM d, yyyy')}
        </p>
      )}
      {!isPaid && !isCancelled && (
        <div className="mt-3 space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div>
            <p className="text-sm font-medium text-[var(--color-ink)]">How to pay</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Send {formatAmount(data.amountCents, data.currency)} to:
            </p>
          </div>

          {canPayByCard ? (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-2">
              <button
                type="button"
                className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={checkoutLoading}
                onClick={() => void startCardCheckout()}
              >
                {checkoutLoading ? 'Opening secure checkout…' : `Pay by card ${formatAmount(data.amountCents, data.currency)}`}
              </button>
              <p className="mt-1 text-xs text-indigo-700">You’ll complete payment on Stripe’s secure page.</p>
              {checkoutError ? <p className="mt-2 text-xs text-red-700">{checkoutError}</p> : null}
            </div>
          ) : paymentDetails?.stripeConnected ? (
            <p className="text-xs text-[var(--color-muted)]">
              Your coach is still finishing card payment setup. Use another method below or check back soon.
            </p>
          ) : null}

          {methods.map((method) => (
            <div key={method.key} className="flex items-center gap-2 text-sm">
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${method.iconClass}`}>
                {method.icon}
              </span>
              <span className="min-w-[56px] text-[var(--color-ink)]">{method.label}</span>
              <span className="flex-1 truncate font-semibold text-[var(--color-ink)]">{method.value}</span>
              <Button
                variant="secondary"
                className="h-7 px-2 py-0 text-xs"
                onClick={() => void copyToClipboard(method.key, method.value as string)}
              >
                Copy
              </Button>
            </div>
          ))}

          {paymentDetails?.paymentInstructions ? (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-xs text-[var(--color-muted)]">
              📝 {paymentDetails.paymentInstructions}
            </div>
          ) : null}

          <Button variant="secondary" className="w-full" onClick={() => void sendPaymentConfirmation()}>
            I&apos;ve sent payment
          </Button>
        </div>
      )}
    </div>
  )
}
