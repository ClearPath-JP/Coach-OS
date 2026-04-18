'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

function initials(first: string, last: string): string {
  const a = first.trim()[0] ?? ''
  const b = last.trim()[0] ?? ''
  return (a + b).toUpperCase() || '?'
}

export function ClientProfileContent({
  clientId,
  initialFirstName,
  initialLastName,
  email,
}: {
  clientId: string
  initialFirstName: string
  initialLastName: string
  email: string
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [firstName, setFirstName] = useState(initialFirstName)
  const [lastName, setLastName] = useState(initialLastName)
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId)
      if (error) {
        setMessage('Could not save — try again.')
        return
      }
      setMessage('Saved.')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const signOut = async () => {
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="client-page-content mx-auto max-w-lg space-y-10 px-4 py-8 md:px-6">
      <h1 className="text-[22px] font-bold text-[var(--text-primary)]">My Profile</h1>

      <section>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">Profile</h2>
        <div className="mt-4 flex flex-col items-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-[var(--accent-light)] text-[18px] font-bold text-[var(--cp-accent)]">
            {initials(firstName, lastName)}
          </div>
          <p className="mt-2 text-[13px] text-[var(--text-tertiary)]">Photo updates go through your coach.</p>
        </div>
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-[var(--text-secondary)]">First name</span>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-[var(--text-secondary)]">Last name</span>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-[var(--text-secondary)]">Email</span>
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-[14px] text-[var(--text-tertiary)]">
              <span aria-hidden>🔒</span>
              <span className="min-w-0 truncate">{email}</span>
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-[var(--text-secondary)]">Phone</span>
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-[14px] text-[var(--text-tertiary)]">
              <span className="min-w-0 truncate text-[var(--text-quaternary)]">Contact your coach to update</span>
            </div>
          </label>
        </div>
        {message ? <p className="mt-2 text-[13px] text-[var(--text-secondary)]">{message}</p> : null}
        <Button type="button" variant="primary" className="mt-4 h-11 w-full sm:w-auto" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </section>

      <section>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">Security</h2>
        <Link
          href="/client/change-password"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-4 text-[14px] font-medium text-[var(--text-primary)] shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--bg-subtle)]"
        >
          Change password
        </Link>
      </section>

      <div className="border-t border-[var(--border-subtle)] pt-8">
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={signingOut}
          className="flex h-11 w-full items-center justify-center rounded-[var(--radius-md)] text-[14px] font-medium text-[var(--error)] transition-colors hover:bg-[var(--error-bg)] disabled:opacity-50"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}
