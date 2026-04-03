'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'

function EyeIcon({ off }: { off?: boolean }) {
  if (off) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function ClientLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, intent: 'client' }),
    })
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(typeof json.error === 'string' ? json.error : 'Invalid email or password. Please try again.')
      return
    }
    router.push('/client/portal')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="client-email" className="mb-1 block text-[13px] font-medium text-[var(--color-text-primary)]">
          Email
        </label>
        <Input
          id="client-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-[44px] w-full"
        />
      </div>
      <div>
        <label htmlFor="client-password" className="mb-1 block text-[13px] font-medium text-[var(--color-text-primary)]">
          Password
        </label>
        <div className="relative">
          <Input
            id="client-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-[44px] w-full py-3 pl-4 pr-12"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-[var(--color-text-secondary)]"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <EyeIcon off={showPassword} />
          </button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-[var(--color-error)]" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="min-h-[44px] w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-70"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center text-[12px] leading-relaxed text-[var(--color-muted)]">
        First time? Use the temporary password your coach gave you. You&apos;ll be asked to set a new one after
        signing in.
      </p>
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--color-border)]" />
        </div>
        <div className="relative flex justify-center text-[12px] text-[var(--color-muted)]">
          <span className="bg-[var(--color-bg)] px-2 text-[13px] text-[var(--color-text-secondary)]">or</span>
        </div>
      </div>
      <p className="text-center text-sm">
        <Link href="/login" className="text-[var(--color-accent)] hover:underline">
          Coach? Sign in here →
        </Link>
      </p>
    </form>
  )
}
