'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const ACCEPT_IMAGE = 'image/jpeg,image/png,image/gif,image/webp'
const MAX_SIZE_MB = 5
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024

export default function OnboardingStep1Page() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [ensuringSignup, setEnsuringSignup] = useState(true)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), 30_000)
      let res: Response
      try {
        res = await fetch('/api/auth/signup-complete', {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
        })
      } catch {
        if (cancelled) return
        setBootstrapError('Request timed out. Check your connection, refresh the page, or sign in again.')
        setEnsuringSignup(false)
        return
      } finally {
        window.clearTimeout(timeoutId)
      }
      if (cancelled) return
      if (res.status === 401) {
        router.push('/login?next=/onboarding')
        return
      }
      if (res.ok) {
        router.refresh()
        setEnsuringSignup(false)
        return
      }
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      setBootstrapError(json.error ?? 'Could not prepare your workspace. Try again.')
      setEnsuringSignup(false)
    })()
    return () => {
      cancelled = true
    }
  }, [router])
  const [nameError, setNameError] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [fileUploadHint, setFileUploadHint] = useState<string | null>(null)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setAvatarFile(null)
      setAvatarPreview(null)
      return
    }
    if (file.size > MAX_BYTES) {
      setFileUploadHint('File must be under 5MB. Please choose a smaller image.')
      setAvatarFile(null)
      setAvatarPreview(null)
      e.target.value = ''
      return
    }
    setFileUploadHint(null)
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setLogoFile(null)
      setLogoPreview(null)
      return
    }
    if (file.size > MAX_BYTES) {
      setFileUploadHint('File must be under 5MB. Please choose a smaller image.')
      setLogoFile(null)
      setLogoPreview(null)
      e.target.value = ''
      return
    }
    setFileUploadHint(null)
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const uploadFile = async (file: File, type: 'avatar' | 'logo'): Promise<string | null> => {
    const form = new FormData()
    form.set('file', file)
    form.set('type', type)
    const res = await fetch('/api/upload', { method: 'POST', body: form, credentials: 'include' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.data?.url) return null
    return json.data.url as string
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setNameError('Workspace name must be at least 2 characters')
      return
    }
    setNameError('')
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      let avatarUrl: string | null = null
      let logoUrl: string | null = null
      if (avatarFile) {
        avatarUrl = await uploadFile(avatarFile, 'avatar')
      }
      if (logoFile) {
        logoUrl = await uploadFile(logoFile, 'logo')
      }
      const res = await fetch('/api/onboarding/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          logo_url: logoUrl,
          avatar_url: avatarUrl,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setNameError(json.error || 'Could not save')
        setSubmitting(false)
        return
      }
      router.push('/onboarding/step-2')
    } catch {
      setNameError('Something went wrong — try again')
      setSubmitting(false)
    }
  }

  if (ensuringSignup) {
    return (
      <div
        className="animate-pulse space-y-5 rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] p-6 shadow-[var(--shadow-sm)] md:p-8"
        aria-busy
        aria-label="Preparing your workspace"
      >
        <div className="h-24 rounded-2xl bg-[var(--bg-muted)]" />
        <div className="h-11 w-full rounded-[var(--radius-md)] bg-[var(--bg-muted)]" />
        <div className="h-28 rounded-xl bg-[var(--bg-muted)]" />
        <div className="h-12 w-full rounded-[var(--radius-md)] bg-[var(--bg-muted)]" />
      </div>
    )
  }

  if (bootstrapError) {
    return (
      <div className="space-y-4 rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] p-6 shadow-[var(--shadow-sm)] md:p-8">
        <h1 className="text-[var(--text-20)] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          Could not start onboarding
        </h1>
        <p className="text-[15px] text-[var(--color-text-secondary)]">{bootstrapError}</p>
        <Button
          type="button"
          onClick={() => {
            setBootstrapError(null)
            setEnsuringSignup(true)
            void fetch('/api/auth/signup-complete', { method: 'POST', credentials: 'include' }).then(async (res) => {
              if (res.status === 401) {
                router.push('/login?next=/onboarding')
                return
              }
              if (res.ok) {
                router.refresh()
                setEnsuringSignup(false)
                return
              }
              const json = (await res.json().catch(() => ({}))) as { error?: string }
              setBootstrapError(json.error ?? 'Still could not prepare your workspace.')
              setEnsuringSignup(false)
            })
          }}
        >
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_min(100%,300px)] lg:items-start">
      <form
        onSubmit={handleSubmit}
        className="space-y-8 rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] p-6 shadow-[var(--shadow-sm)] md:p-8"
      >
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[linear-gradient(135deg,var(--accent-light)_0%,var(--cp-offwhite)_55%)] p-5 md:p-6">
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[var(--cp-accent)]/15 blur-2xl"
            aria-hidden
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--cp-accent)]">Workspace</p>
          <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)] md:text-[24px]">
            Set up your workspace
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
            Name your coaching business and add a photo or logo — you can change these anytime in settings.
          </p>
          <p className="mt-3 text-[13px] font-medium text-[var(--text-tertiary)]">Takes about 2 minutes.</p>
        </div>

        <div>
          <label htmlFor="workspace-name" className="mb-1 block text-[15px] font-medium text-[var(--text-primary)]">
            Workspace name <span className="text-[var(--color-error)]">*</span>
          </label>
          <Input
            id="workspace-name"
            type="text"
            placeholder="Your coaching business name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!nameError}
            errorMessage={nameError}
            minLength={2}
            required
            className="w-full"
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/80 p-4">
            <label className="mb-2 block text-[14px] font-medium text-[var(--text-primary)]">
              Profile photo <span className="font-normal text-[var(--text-tertiary)]">(optional)</span>
            </label>
            <p className="mb-3 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
              Shown to clients in messages and the portal — builds trust fast.
            </p>
            <input
              type="file"
              accept={ACCEPT_IMAGE}
              onChange={handleAvatarChange}
              className="block w-full text-sm text-[var(--color-text-secondary)] file:mr-2 file:rounded-lg file:border-0 file:bg-[var(--cp-offwhite)] file:px-3 file:py-2 file:font-medium file:shadow-sm"
            />
            {avatarPreview && (
              <div className="relative mt-3 h-24 w-24 overflow-hidden rounded-full border border-[var(--color-border)] shadow-sm">
                <Image
                  src={avatarPreview}
                  alt="Profile preview"
                  fill
                  className="object-cover"
                  sizes="96px"
                  unoptimized
                />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/80 p-4">
            <label className="mb-2 block text-[14px] font-medium text-[var(--text-primary)]">
              Logo <span className="font-normal text-[var(--text-tertiary)]">(optional)</span>
            </label>
            <p className="mb-3 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
              Keeps invoices, emails, and shared links feeling like your brand.
            </p>
            <input
              type="file"
              accept={ACCEPT_IMAGE}
              onChange={handleLogoChange}
              className="block w-full text-sm text-[var(--color-text-secondary)] file:mr-2 file:rounded-lg file:border-0 file:bg-[var(--cp-offwhite)] file:px-3 file:py-2 file:font-medium file:shadow-sm"
            />
            {logoPreview && (
              <div className="relative mt-3 h-16 w-32 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--cp-offwhite)] shadow-sm">
                <Image
                  src={logoPreview}
                  alt="Logo preview"
                  fill
                  className="object-contain p-1"
                  sizes="128px"
                  unoptimized
                />
              </div>
            )}
          </div>
        </div>

        {fileUploadHint ? (
          <p className="text-[14px] text-[var(--color-error)]" role="alert">
            {fileUploadHint}
          </p>
        ) : null}

        <Button type="submit" disabled={submitting} fullWidth size="lg">
          {submitting ? 'Saving…' : 'Continue'}
        </Button>
      </form>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--cp-offwhite)] p-5 shadow-[var(--shadow-sm)]">
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Why this matters</h2>
          <ul className="mt-3 space-y-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            <li className="flex gap-2">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-light)] text-[11px] font-bold text-[var(--cp-accent)]">
                1
              </span>
              <span>Your workspace name is how you&apos;ll spot this account in Sensei App and on client-facing surfaces.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-light)] text-[11px] font-bold text-[var(--cp-accent)]">
                2
              </span>
              <span>Photos and logos are optional — skip them now if you&apos;re in a hurry; you can upload later in settings.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-light)] text-[11px] font-bold text-[var(--cp-accent)]">
                3
              </span>
              <span>We accept JPEG, PNG, GIF, or WebP up to {MAX_SIZE_MB} MB per file.</span>
            </li>
          </ul>
        </div>
        <div className="rounded-2xl border border-dashed border-[var(--accent-muted)] bg-[var(--accent-light)]/40 px-5 py-4 text-[12px] leading-relaxed text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">Tip:</span> Use the same name clients already know you by —
          it reduces confusion when they get invites or receipts.
        </div>
      </aside>
    </div>
  )
}
