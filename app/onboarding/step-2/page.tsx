'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

const COACHING_TYPES = [
  { id: 'Fitness', label: 'Fitness', icon: DumbbellIcon },
  { id: 'Life', label: 'Life', icon: HeartIcon },
  { id: 'Business', label: 'Business', icon: BriefcaseIcon },
  { id: 'Nutrition', label: 'Nutrition', icon: LeafIcon },
  { id: 'Mindset', label: 'Mindset', icon: SparkIcon },
  { id: 'Performance', label: 'Performance', icon: TargetIcon },
  { id: 'Career', label: 'Career', icon: LadderIcon },
  { id: 'Relationships', label: 'Relationships', icon: UsersIcon },
  { id: 'Other', label: 'Other', icon: MoreIcon },
] as const

function DumbbellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M6 7h4M14 17h4M6 17h4M14 7h4" strokeLinecap="round" />
      <path d="M10 7v10M14 7v10M4 9v6M20 9v6" strokeLinecap="round" />
    </svg>
  )
}
function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 21s-7-4.35-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.65-7 10-7 10z" strokeLinejoin="round" />
    </svg>
  )
}
function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}
function LeafIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  )
}
function SparkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 3v3M12 18v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M3 12h3M18 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  )
}
function LadderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M8 3v18M16 3v18M8 8h8M8 14h8" strokeLinecap="round" />
    </svg>
  )
}
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
function MoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

export default function OnboardingStep2Page() {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [clientCount, setClientCount] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (type: string) => {
    setSelected((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const countStr = clientCount.trim()
      const current_client_count = countStr === '' ? null : parseInt(countStr, 10)
      const res = await fetch('/api/onboarding/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coaching_types: selected,
          current_client_count:
            current_client_count !== null && !Number.isNaN(current_client_count) && current_client_count >= 0
              ? current_client_count
              : null,
        }),
      })
      if (!res.ok) {
        setError('Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }
      router.push('/onboarding/step-3')
    } catch {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-8 rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--bg-app)] p-6 shadow-[var(--shadow-sm)] md:p-8"
    >
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[linear-gradient(125deg,#F0FDF4_0%,var(--bg-app)_50%)] p-5 md:p-6">
        <div
          className="pointer-events-none absolute -right-6 top-0 h-24 w-24 rounded-full bg-[var(--success)]/15 blur-2xl"
          aria-hidden
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--success)]">Your focus</p>
        <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)] md:text-[24px]">
          What kind of coaching do you do?
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
          Pick all that apply — this helps us tailor your experience and surface the right defaults as you grow.
        </p>
      </div>

      <div>
        <p className="mb-3 text-[13px] font-medium text-[var(--text-primary)]">Coaching specialties</p>
        <div className="flex flex-wrap gap-2">
          {COACHING_TYPES.map(({ id, label, icon: Icon }) => {
            const on = selected.includes(id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all',
                  on
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white shadow-sm'
                    : 'border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-muted)] hover:bg-[var(--accent-light)]/60'
                )}
              >
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full',
                    on ? 'bg-white/20 text-white' : 'bg-[var(--bg-app)] text-[var(--accent)]'
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/70 p-5">
        <label htmlFor="client-count" className="mb-1 block text-[15px] font-medium text-[var(--color-text-primary)]">
          How many clients do you currently have?
        </label>
        <p className="mb-3 text-[12px] text-[var(--text-tertiary)]">
          A rough count is fine — we use this to suggest onboarding shortcuts, not to limit your account.
        </p>
        <Input
          id="client-count"
          type="number"
          min={0}
          placeholder="0"
          value={clientCount}
          onChange={(e) => setClientCount(e.target.value)}
          className="w-full max-w-[140px]"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={submitting} size="lg">
          {submitting ? 'Saving…' : 'Continue'}
        </Button>
        <Link
          href="/onboarding"
          className="text-center text-[15px] font-medium text-[var(--color-accent)] hover:underline sm:text-left"
        >
          Back
        </Link>
      </div>

      {error ? (
        <p
          className="rounded-[var(--radius-lg)] border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3 text-[14px] text-[var(--error)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </form>
  )
}
