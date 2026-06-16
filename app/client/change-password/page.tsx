'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ClientAuthBrandTitle } from '@/components/client/ClientAuthBrandTitle'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function ClientChangePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password,
        data: { must_change_password: false },
      })
      if (updateErr) {
        setError(updateErr.message || 'Could not update password')
        return
      }
      router.replace('/client/portal')
      router.refresh()
    } catch {
      setError('Something went wrong — try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-8">
      <ClientAuthBrandTitle className="text-center text-lg font-medium text-[var(--color-ink)]" />
      <h2 className="mt-4 font-[family-name:var(--font-display)] text-xl font-extrabold text-[var(--text-primary)]">Set your password</h2>
      <p className="mt-2 text-[15px] text-[var(--color-muted)]">
        Choose a new password to secure your account
      </p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="new-password" className="mb-1 block text-[13px] font-medium text-[var(--color-ink)]">
            New password
          </label>
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            disabled={submitting}
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1 block text-[13px] font-medium text-[var(--color-ink)]">
            Confirm password
          </label>
          <Input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            disabled={submitting}
          />
        </div>
        {error && <p className="text-[13px] text-[var(--color-error)]">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Saving…' : 'Set password'}
        </Button>
      </form>
    </div>
  )
}
