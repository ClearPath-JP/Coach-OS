'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type DomainRecord = {
  id: string
  domain: string
  status: string
  verification_token: string
  verification_method: string
  last_checked_at: string | null
  error_message: string | null
  ssl_status: string
  domain_verified: boolean
  requested_at: string
}

function StatusBadge({ status, verified }: { status: string; verified: boolean }) {
  if (verified && status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className="h-3.5 w-3.5"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm3.28-8.72a.75.75 0 0 0-1.06-1.06L7 8.44 5.78 7.22a.75.75 0 0 0-1.06 1.06l1.75 1.75a.75.75 0 0 0 1.06 0l3.75-3.75Z"
            clipRule="evenodd"
          />
        </svg>
        Verified
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-400">
        Error
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-400">
      Pending verification
    </span>
  )
}

export function CustomDomainSection() {
  const [domainRecord, setDomainRecord] = useState<DomainRecord | null>(null)
  const [domainInput, setDomainInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const fetchDomain = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/settings/domain', {
        cache: 'no-store',
        credentials: 'include',
      })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.data) {
        setDomainRecord(json.data)
        setDomainInput(json.data.domain ?? '')
      } else if (res.ok && json?.data === null) {
        setDomainRecord(null)
        setDomainInput('')
      } else {
        setError(json?.error ?? 'Could not load domain settings')
      }
    } catch {
      setError('Could not load domain settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDomain()
  }, [fetchDomain])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(t)
  }, [toast])

  const saveDomain = async () => {
    const trimmed = domainInput.trim().toLowerCase()
    if (!trimmed) {
      setToast('Enter a domain first')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ domain: trimmed }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setToast(json?.error ?? 'Could not save domain')
        return
      }
      setDomainRecord(json.data)
      setDomainInput(json.data.domain)
      setToast('Domain saved — follow the instructions below to verify')
    } catch {
      setToast('Something went wrong — check your connection and try again')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-32 rounded bg-[var(--border-default)]" />
        <div className="h-10 w-full rounded-lg bg-[var(--border-default)]" />
      </div>
    )
  }

  const isVerified = domainRecord?.domain_verified && domainRecord?.status === 'active'
  const isPending =
    domainRecord &&
    !domainRecord.domain_verified &&
    domainRecord.status !== 'error'
  const isError = domainRecord?.status === 'error'
  const hasChanged =
    domainInput.trim().toLowerCase() !== (domainRecord?.domain ?? '')

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
          Custom domain
        </h2>
        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
          Give your clients a branded URL like app.yourbrand.com
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
          {toast}
        </div>
      )}

      {/* Error loading */}
      {error && !domainRecord && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {/* Domain input + save */}
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
            Domain
          </label>
          <Input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="app.yourbrand.com"
          />
        </div>
        <Button
          onClick={saveDomain}
          disabled={saving || !domainInput.trim() || (!hasChanged && !!domainRecord)}
        >
          {saving ? 'Saving...' : domainRecord ? 'Update Domain' : 'Save Domain'}
        </Button>
      </div>

      {/* Current status */}
      {domainRecord && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--color-text-secondary)]">
            {domainRecord.domain}
          </span>
          <StatusBadge
            status={domainRecord.status}
            verified={domainRecord.domain_verified}
          />
        </div>
      )}

      {/* Verification instructions */}
      {isPending && (
        <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            DNS setup required
          </p>
          <ol className="list-inside list-decimal space-y-2 text-sm text-[var(--color-text-secondary)]">
            <li>
              Go to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)
            </li>
            <li>
              Add a <strong className="text-[var(--color-text-primary)]">CNAME</strong> record:
              <div className="mt-1.5 overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[var(--color-text-secondary)]">Name:</span>{' '}
                    <span className="text-[var(--color-text-primary)]">
                      {domainRecord.domain.split('.')[0]}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-secondary)]">Value:</span>{' '}
                    <span className="text-[var(--color-text-primary)]">
                      cname.vercel-dns.com
                    </span>
                  </div>
                </div>
              </div>
            </li>
            <li>
              DNS changes can take up to 48 hours to propagate, but usually
              happen within minutes.
            </li>
          </ol>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Once your CNAME is set, domain verification will happen automatically.
          </p>
        </div>
      )}

      {/* Error state */}
      {isError && domainRecord?.error_message && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {domainRecord.error_message}
        </div>
      )}

      {/* Verified state */}
      {isVerified && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
          Your custom domain is active. Clients can access your portal at{' '}
          <strong>https://{domainRecord.domain}</strong>
        </div>
      )}

      {/* No domain configured */}
      {!domainRecord && !error && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          No custom domain configured. Enter a domain above to get started.
        </p>
      )}
    </div>
  )
}
