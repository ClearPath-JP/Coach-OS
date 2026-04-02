'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AdminGuideLink } from '@/components/admin/AdminGuideLink'
import { Button } from '@/components/ui/Button'

type LivePrice = {
  active: boolean
  currency: string
  unitAmount: number | null
  interval: string | null
  type: string
  nickname: string | null
  productName: string | null
}

type PriceRow =
  | { configured: false }
  | { configured: true; priceId: string; live: null; error: string }
  | { configured: true; priceId: string; live: LivePrice }

type PlanRow = {
  tier: string
  label: string
  monthlyEnv: string
  setupEnv: string
  monthly: PriceRow
  setupFee: PriceRow
}

type CatalogData = {
  stripeSecretConfigured: boolean
  webhookSecretConfigured: boolean
  connectDefaultCountry: string
  billingUiCopy: {
    monthlyDisplay: Record<string, string>
    setupFeeDisplay: Record<string, string>
    note: string
  }
  plans: PlanRow[]
}

function formatMoney(unitAmount: number | null, currency: string): string {
  if (unitAmount == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(unitAmount / 100)
}

function PriceCell({ row, kind }: { row: PriceRow; kind: 'recurring' | 'one_time' }) {
  if (!row.configured) {
    return <span className="text-sm text-slate-400">Not set in env</span>
  }
  if (row.live === null) {
    return (
      <div className="space-y-1">
        <code className="block break-all text-[11px] text-slate-700">{row.priceId}</code>
        <p className="text-xs text-amber-700">{row.error}</p>
      </div>
    )
  }
  const { live } = row
  const amount = formatMoney(live.unitAmount, live.currency)
  const schedule =
    live.type === 'recurring' && live.interval ? ` / ${live.interval}` : live.type === 'one_time' ? ' (one-time)' : ''
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-900">
          {amount}
          {schedule}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
            live.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {live.active ? 'Active' : 'Inactive'}
        </span>
      </div>
      {live.productName ? <p className="text-xs text-slate-600">{live.productName}</p> : null}
      {live.nickname ? <p className="text-xs text-slate-500">Nickname: {live.nickname}</p> : null}
      <code className="block break-all text-[11px] text-slate-500">{row.priceId}</code>
    </div>
  )
}

export default function AdminStripePage() {
  const [data, setData] = useState<CatalogData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/admin/stripe-catalog')
      const json = await r.json()
      if (!r.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not load Stripe catalog')
        setData(null)
        return
      }
      setData(json.data ?? null)
    } catch {
      setError('Network error')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Stripe catalog</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Price IDs from environment variables and live amounts from Stripe. Coaches see the billing page; this view is
            for verifying production configuration.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            See <AdminGuideLink className="font-medium text-blue-700 hover:underline" /> → &ldquo;Stripe catalog&rdquo; for
            context.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Link
            href="https://dashboard.stripe.com/prices"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Open Stripe Dashboard →
          </Link>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Environment</h2>
            <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              <li>
                <span className="text-slate-500">STRIPE_SECRET_KEY:</span>{' '}
                {data.stripeSecretConfigured ? (
                  <span className="font-medium text-emerald-700">Set</span>
                ) : (
                  <span className="font-medium text-amber-700">Missing</span>
                )}
              </li>
              <li>
                <span className="text-slate-500">STRIPE_WEBHOOK_SECRET:</span>{' '}
                {data.webhookSecretConfigured ? (
                  <span className="font-medium text-emerald-700">Set</span>
                ) : (
                  <span className="font-medium text-amber-700">Missing</span>
                )}
              </li>
              <li className="sm:col-span-2">
                <span className="text-slate-500">STRIPE_CONNECT_DEFAULT_COUNTRY:</span>{' '}
                <code className="rounded bg-slate-100 px-1 text-xs">{data.connectDefaultCountry}</code>
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-sm font-semibold text-slate-900">Billing page copy (marketing)</h2>
            <p className="mt-1 text-xs text-slate-600">{data.billingUiCopy.note}</p>
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Plan</th>
                    <th className="px-4 py-2 font-medium">Shown monthly</th>
                    <th className="px-4 py-2 font-medium">Shown setup fee</th>
                  </tr>
                </thead>
                <tbody>
                  {data.plans.map((p) => (
                    <tr key={p.tier} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-slate-900">{p.label}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {data.billingUiCopy.monthlyDisplay[p.tier] ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {data.billingUiCopy.setupFeeDisplay[p.tier] ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Configured prices (Stripe API)</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Monthly subscription IDs and optional one-time setup fee IDs from Vercel / .env.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Monthly</th>
                    <th className="px-4 py-3 font-medium">Setup fee</th>
                  </tr>
                </thead>
                <tbody>
                  {data.plans.map((p) => (
                    <tr key={p.tier} className="border-b border-slate-100 align-top last:border-0">
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-900">{p.label}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{p.monthlyEnv}</p>
                        <p className="text-[11px] text-slate-500">{p.setupEnv}</p>
                      </td>
                      <td className="px-4 py-4">
                        <PriceCell row={p.monthly} kind="recurring" />
                      </td>
                      <td className="px-4 py-4">
                        <PriceCell row={p.setupFee} kind="one_time" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" aria-hidden />
      ) : null}
    </div>
  )
}
