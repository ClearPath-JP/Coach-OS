'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

function CardIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--accent-light)] text-[var(--accent)]">
      {children}
    </div>
  )
}

function IconUser() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconClipboard() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h6" strokeLinecap="round" />
    </svg>
  )
}

function IconVideo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M16 10l6-3v10l-6-3v-4z" strokeLinejoin="round" />
    </svg>
  )
}

const ctaClass =
  'mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-app)] text-[14px] font-medium text-[var(--text-primary)] transition-colors group-hover:border-[var(--accent-muted)] group-hover:bg-[var(--accent-light)] group-hover:text-[var(--accent)]'

export default function OnboardingStep4Page() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleGoToDashboard = async () => {
    setActionError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/workspaces/complete-onboarding', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setActionError(json.error ?? 'Could not finish onboarding. Try again.')
        setLoading(false)
        return
      }
      router.refresh()
      router.push('/coach/dashboard')
    } catch {
      setActionError('Something went wrong — check your connection and try again.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-10 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-app)] shadow-[var(--shadow-sm)]">
      <div className="relative overflow-hidden border-b border-[var(--border-subtle)] bg-[linear-gradient(135deg,var(--accent-light)_0%,var(--bg-app)_45%,#E8F4FC_100%)] px-6 py-8 md:px-8 md:py-10">
        <div
          className="pointer-events-none absolute -right-10 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-[var(--accent)]/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-10 top-0 h-24 w-24 rounded-full bg-[#1056A0]/10 blur-2xl"
          aria-hidden
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">You&apos;re in</p>
        <h1 className="mt-1 max-w-xl text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)] md:text-[28px]">
          You&apos;re ready to go
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
          ClearPath is set up for your workspace. Choose a quick win below, or jump straight to the dashboard — you can
          explore everything at your own pace.
        </p>
      </div>

      <div className="grid gap-4 px-6 pb-2 md:grid-cols-3 md:px-8">
        <Link
          href="/coach/clients"
          className="group block rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-6 transition-all hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md"
        >
          <CardIcon>
            <IconUser />
          </CardIcon>
          <CardTitle className="mb-1">Add a client</CardTitle>
          <p className="text-[15px] leading-relaxed text-[var(--text-secondary)]">
            Add clients and manage their profiles and access.
          </p>
          <span className={ctaClass}>Add a client</span>
        </Link>

        <Link
          href="/coach/programs"
          className="group block rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-6 transition-all hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md"
        >
          <CardIcon>
            <IconClipboard />
          </CardIcon>
          <CardTitle className="mb-1">Create a program</CardTitle>
          <p className="text-[15px] leading-relaxed text-[var(--text-secondary)]">
            Build programs and assign them to clients.
          </p>
          <span className={ctaClass}>Create a program</span>
        </Link>

        <Link
          href="/coach/videos"
          className="group block rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-6 transition-all hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md"
        >
          <CardIcon>
            <IconVideo />
          </CardIcon>
          <CardTitle className="mb-1">Add videos</CardTitle>
          <p className="text-[15px] leading-relaxed text-[var(--text-secondary)]">
            Set your import folder and upload videos from your phone or computer.
          </p>
          <span className={ctaClass}>Go to videos</span>
        </Link>
      </div>

      <div className="space-y-2 border-t border-[var(--border-subtle)] px-6 pb-8 pt-6 md:px-8">
        {actionError ? (
          <p className="text-center text-[15px] text-[var(--error)]" role="alert">
            {actionError}
          </p>
        ) : null}
        <Button onClick={handleGoToDashboard} disabled={loading} fullWidth size="lg">
          {loading ? 'Loading…' : 'Go to dashboard'}
        </Button>
      </div>
    </div>
  )
}
