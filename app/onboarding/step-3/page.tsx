'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

function MailIllustration() {
  return (
    <svg viewBox="0 0 120 96" fill="none" className="h-auto w-full max-w-[200px] text-[var(--accent)]" aria-hidden>
      <rect x="8" y="20" width="104" height="64" rx="12" className="stroke-current" strokeWidth="2" fill="var(--accent-light)" />
      <path d="M8 32l52 36 52-36" className="stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="88" cy="36" r="14" fill="var(--bg-app)" className="stroke-current" strokeWidth="2" />
      <path d="M84 36l3 3 6-6" className="stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function OnboardingStep3Page() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [inviteSentTo, setInviteSentTo] = useState<string | null>(null)

  useEffect(() => {
    if (inviteSentTo === null) return
    const t = setTimeout(() => router.push('/onboarding/step-4'), 1500)
    return () => clearTimeout(t)
  }, [inviteSentTo, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const resCreate = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
        }),
      })
      const jsonCreate = await resCreate.json()
      if (!resCreate.ok) {
        setError(jsonCreate.error || 'Could not add client')
        setSubmitting(false)
        return
      }
      const resInvite = await fetch('/api/invite-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const jsonInvite = await resInvite.json()
      if (!resInvite.ok) {
        setError(jsonInvite.error || 'Client added but invite could not be sent')
        setSubmitting(false)
        return
      }
      setInviteSentTo(email.trim().toLowerCase())
    } catch {
      setError('Something went wrong — try again')
      setSubmitting(false)
    }
  }

  if (inviteSentTo) {
    return (
      <div className="space-y-6 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-app)] p-6 shadow-[var(--shadow-sm)] md:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-[var(--color-success-light)] text-[var(--success)]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)] md:text-[24px]">
            Invite on its way
          </h1>
          <p className="mt-2 max-w-md text-[15px] text-[var(--text-secondary)]">
            We sent an email to <span className="font-medium text-[var(--text-primary)]">{inviteSentTo}</span> with a link to
            the client portal.
          </p>
        </div>
        <p className="rounded-[var(--radius-lg)] border border-[var(--color-success)] bg-[var(--color-success-light)] px-4 py-3 text-center text-[14px] text-[var(--text-primary)]">
          Taking you to the next step…
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
      <form
        onSubmit={handleSubmit}
        className="space-y-8 rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-app)] p-6 shadow-[var(--shadow-sm)] md:p-8"
      >
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[linear-gradient(130deg,#FFF7ED_0%,var(--bg-app)_55%)] p-5 md:p-6">
          <div
            className="pointer-events-none absolute -left-4 bottom-0 h-20 w-20 rounded-full bg-[var(--warning)]/20 blur-2xl"
            aria-hidden
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--warning)]">First client</p>
          <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)] md:text-[24px]">
            Invite your first client
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
            Optional for now — you can add clients anytime from your dashboard. When you&apos;re ready, we&apos;ll send them a
            secure link to their portal.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="first-name" className="mb-1 block text-[15px] font-medium text-[var(--text-primary)]">
              First name
            </label>
            <Input
              id="first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="last-name" className="mb-1 block text-[15px] font-medium text-[var(--text-primary)]">
              Last name
            </label>
            <Input
              id="last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-[15px] font-medium text-[var(--text-primary)]">
            Email <span className="text-[var(--color-error)]">*</span>
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="client@email.com"
            className="w-full"
          />
        </div>

        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

        <div className="flex flex-col gap-3">
          <Button type="submit" disabled={submitting} fullWidth size="lg">
            {submitting ? 'Sending…' : 'Send invite'}
          </Button>
          <Link
            href="/onboarding/step-4"
            className="text-center text-[15px] font-medium text-[var(--color-accent)] hover:underline"
          >
            Skip for now
          </Link>
          <Link
            href="/onboarding/step-2"
            className="text-center text-[15px] text-[var(--color-text-secondary)] hover:underline"
          >
            Back
          </Link>
        </div>
      </form>

      <aside className="flex flex-col items-center gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-app)] p-6 text-center shadow-[var(--shadow-sm)] lg:sticky lg:top-24">
        <MailIllustration />
        <div className="space-y-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
          <p className="font-medium text-[var(--text-primary)]">What happens next</p>
          <ul className="space-y-2 text-left">
            <li className="flex gap-2">
              <span className="text-[var(--accent)]" aria-hidden>
                •
              </span>
              We create their client record under your workspace.
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--accent)]" aria-hidden>
                •
              </span>
              They get an email to set a password and open the portal.
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--accent)]" aria-hidden>
                •
              </span>
              You can resend invites anytime from Clients.
            </li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
