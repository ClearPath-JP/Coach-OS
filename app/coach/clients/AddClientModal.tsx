'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { addClientSchema, type AddClientInput } from '@/lib/validations'

interface AddClientModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const defaultValues: AddClientInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  goals: '',
}

type CreatedClient = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  status: string
  created_at: string
}

export function AddClientModal({ isOpen, onClose, onSuccess }: AddClientModalProps) {
  const [form, setForm] = useState<AddClientInput>(defaultValues)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AddClientInput, string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successData, setSuccessData] = useState<{
    client: CreatedClient
    tempPassword: string
    email: string
    displayName: string
  } | null>(null)
  const [passwordRevealed, setPasswordRevealed] = useState(false)
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)

  const update = (key: keyof AddClientInput, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
    setSubmitError(null)
  }

  const resetAndClose = () => {
    setForm(defaultValues)
    setFieldErrors({})
    setSubmitError(null)
    setSuccessData(null)
    setPasswordRevealed(false)
    setInviteMessage(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    const parsed = addClientSchema.safeParse(form)
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors as Record<keyof AddClientInput, string[] | undefined>
      const errors: Partial<Record<keyof AddClientInput, string>> = {}
      for (const k of Object.keys(flat) as (keyof AddClientInput)[]) {
        if (flat[k]?.[0]) errors[k] = flat[k][0]
      }
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setSubmitting(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error ?? 'Could not add client')
        return
      }
      const client = json.data?.client as CreatedClient | undefined
      const tempPassword = json.data?.tempPassword as string | undefined
      if (!client || !tempPassword) {
        setSubmitError('Unexpected response from server')
        return
      }
      const displayName = [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Client'
      const email = client.email ?? parsed.data.email.trim().toLowerCase()
      setSuccessData({ client, tempPassword, email, displayName })
      setPasswordRevealed(false)
      setInviteMessage(null)
    } catch {
      setSubmitError('Something went wrong — check your connection and try again')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendInvite = async () => {
    if (!successData) return
    setInviteMessage(null)
    setInviteSending(true)
    try {
      const res = await fetch('/api/invite-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: successData.email }),
      })
      const json = await res.json()
      if (!res.ok) {
        setInviteMessage(json.error ?? 'Could not send invite email')
        return
      }
      setInviteMessage('Invite email sent')
    } catch {
      setInviteMessage('Could not send invite — try again')
    } finally {
      setInviteSending(false)
    }
  }

  const handleDone = () => {
    onSuccess()
    resetAndClose()
  }

  const handleClose = () => {
    if (!submitting && !inviteSending) {
      resetAndClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={successData ? 'Client created' : 'Add client'}>
      {successData ? (
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-success)]/15 text-2xl text-[var(--color-success)]"
              aria-hidden
            >
              ✓
            </div>
            <h2 className="text-lg font-medium text-[var(--color-ink)]">Client account created</h2>
            <p className="mt-1 text-[15px] text-[var(--color-muted)]">{successData.displayName}</p>
            <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">{successData.email}</p>
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-[13px] font-medium text-[var(--color-ink)]">Temporary password</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {passwordRevealed ? (
                <code className="rounded bg-[var(--color-bg)] px-2 py-1 text-[14px] text-[var(--color-ink)]">
                  {successData.tempPassword}
                </code>
              ) : (
                <span className="text-[var(--color-muted)]">••••••••••••</span>
              )}
              <Button
                type="button"
                variant="secondary"
                className="text-[13px]"
                onClick={() => setPasswordRevealed((v) => !v)}
              >
                {passwordRevealed ? 'Hide password' : 'Reveal password'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="text-[13px]"
                disabled={!passwordRevealed}
                onClick={() => {
                  if (passwordRevealed) {
                    void navigator.clipboard.writeText(successData.tempPassword)
                  }
                }}
              >
                Copy
              </Button>
            </div>
          </div>

          <p className="text-[13px] text-[var(--color-muted)]">
            Share this password with your client. They will be asked to change it on first login.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="secondary"
              onClick={handleSendInvite}
              disabled={inviteSending}
              className="w-full sm:w-auto"
            >
              {inviteSending ? 'Sending…' : 'Send invite email'}
            </Button>
            {inviteMessage && (
              <p className="self-center text-[13px] text-[var(--color-muted)]">{inviteMessage}</p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button type="button" onClick={handleDone}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="add-client-first-name" className="mb-1 block text-[13px] font-medium text-[var(--color-text-primary)]">
              First name *
            </label>
            <Input
              id="add-client-first-name"
              value={form.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              placeholder="First name"
              error={!!fieldErrors.firstName}
              errorMessage={fieldErrors.firstName}
              disabled={submitting}
              autoComplete="given-name"
              required
            />
          </div>
          <div>
            <label htmlFor="add-client-last-name" className="mb-1 block text-[13px] font-medium text-[var(--color-text-primary)]">
              Last name *
            </label>
            <Input
              id="add-client-last-name"
              value={form.lastName}
              onChange={(e) => update('lastName', e.target.value)}
              placeholder="Last name"
              error={!!fieldErrors.lastName}
              errorMessage={fieldErrors.lastName}
              disabled={submitting}
              autoComplete="family-name"
              required
            />
          </div>
          <div>
            <label htmlFor="add-client-email" className="mb-1 block text-[13px] font-medium text-[var(--color-text-primary)]">
              Email *
            </label>
            <Input
              id="add-client-email"
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="email@example.com"
              error={!!fieldErrors.email}
              errorMessage={fieldErrors.email}
              disabled={submitting}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label htmlFor="add-client-phone" className="mb-1 block text-[13px] font-medium text-[var(--color-text-primary)]">
              Phone
            </label>
            <Input
              id="add-client-phone"
              type="tel"
              value={form.phone ?? ''}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="Optional"
              error={!!fieldErrors.phone}
              errorMessage={fieldErrors.phone}
              disabled={submitting}
              autoComplete="tel"
            />
          </div>
          <div>
            <label htmlFor="add-client-goals" className="mb-1 block text-[13px] font-medium text-[var(--color-text-primary)]">
              Goals
            </label>
            <Textarea
              id="add-client-goals"
              value={form.goals ?? ''}
              onChange={(e) => update('goals', e.target.value)}
              placeholder="Optional goals or notes"
              error={!!fieldErrors.goals}
              errorMessage={fieldErrors.goals}
              disabled={submitting}
              rows={3}
            />
          </div>
          {submitError && (
            <p className="text-[13px] text-[var(--color-error)]">{submitError}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="min-w-[120px]">
              {submitting ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
                  <span className="sr-only">Saving…</span>
                </span>
              ) : (
                'Add client'
              )}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
