'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

function isSafeNext(next: string | null): next is string {
  if (!next || typeof next !== 'string') return false
  try {
    const path = new URL(next, 'http://localhost').pathname
    return path.startsWith('/coach/') || path.startsWith('/client/')
  } catch {
    return false
  }
}

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

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextParam = searchParams.get('next')
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
      body: JSON.stringify({ email, password, intent: 'coach' }),
    })
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      const msg = typeof json.error === 'string' ? json.error : 'Invalid email or password. Please try again.'
      if (res.status === 429) {
        setError('Too many attempts — please wait a minute and try again.')
      } else {
        setError(msg)
      }
      return
    }
    const next = isSafeNext(nextParam) ? nextParam : undefined
    router.push(next ?? '/')
    router.refresh()
  }

  const rateLimitMessage =
    searchParams.get('error') === 'rate_limit'
      ? 'Too many failed sign-in attempts. Please try again in 15 minutes.'
      : null
  const passwordResetMessage =
    searchParams.get('message') === 'password_reset'
      ? 'Your password has been updated. Sign in with your new password.'
      : null

  const labelCls = 'mb-1.5 block text-[13px] font-medium text-[var(--text-secondary)]'

  return (
    <div className="flex flex-col gap-4">
      {rateLimitMessage && (
        <p
          className="rounded-[var(--radius-md)] bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]"
          role="alert"
        >
          {rateLimitMessage}
        </p>
      )}
      {passwordResetMessage && !rateLimitMessage && (
        <p
          className="rounded-[var(--radius-md)] bg-[var(--accent-light)] px-4 py-3 text-sm text-[var(--accent)]"
          role="status"
        >
          {passwordResetMessage}
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="login-email" className={labelCls}>
            Email <span className="text-[var(--error)]">*</span>
          </label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            inputSize="lg"
            className="h-10 min-h-10"
          />
        </div>
        <div>
          <label htmlFor="login-password" className={labelCls}>
            Password <span className="text-[var(--error)]">*</span>
          </label>
          <div className="relative">
            <Input
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              inputSize="lg"
              className={cn('h-10 min-h-10 pr-12')}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
          <div className="-mt-1 flex justify-end pt-1">
            <Link href="/forgot-password" className="link-nav text-[13px] font-medium">
              Forgot password?
            </Link>
          </div>
        </div>
        {error && (
          <p className="text-sm text-[var(--error)]" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="xl" fullWidth loading={loading} className="mt-2">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--border-default)]" />
        <span className="text-[12px] text-[var(--text-quaternary)]">or</span>
        <div className="h-px flex-1 bg-[var(--border-default)]" />
      </div>

      <p className="text-center text-[13px]">
        <Link href="/signup" className="link-nav font-medium">
          New to ClearPath? Start free →
        </Link>
      </p>
      <p className="text-center text-[12px] text-[var(--text-tertiary)]">
        Client?{' '}
        <Link
          href="/client-login"
          className="link-nav font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)]"
        >
          Sign in here →
        </Link>
      </p>
      <p className="text-center text-[12px] text-[var(--text-tertiary)]">
        <Link href="/terms" className="link-nav">
          Terms of Service
        </Link>
        <span className="mx-2 text-[var(--border-default)]" aria-hidden>
          ·
        </span>
        <Link href="/privacy" className="link-nav">
          Privacy Policy
        </Link>
      </p>
    </div>
  )
}
