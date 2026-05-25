'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase'
import { applyWorkspaceAccentVars, getAccentLight } from '@/lib/accent-colors'
import { coerceToAllowedCoachAccent, PHASE4_DEFAULT_COACH_ACCENT } from '@/lib/coach-accent-phase4'
import { useWorkspace } from '@/lib/workspace-context'
import { cn } from '@/lib/utils'
import { WorkspaceStorageSection } from '@/components/coach/WorkspaceStorageSection'
import { CustomDomainSection } from '@/components/settings/CustomDomainSection'
import { AccentColorPicker } from '@/components/settings/AccentColorPicker'
import { PageHeader } from '@/components/layout/PageHeader'
import type { AccentColor } from '@/types/coach'
import { DEFAULT_AUTO_CHECKIN_MESSAGE } from '@/lib/re-engagement-default-message'

type TabKey = 'profile' | 'workspace' | 'payments' | 'appearance' | 'notifications'
type NotificationKey = 'newMessage' | 'sessionReminder' | 'clientActivity' | 'paymentReceived'

type SettingsResponse = {
  data: {
    workspace: {
      id: string
      name: string | null
      displayName: string | null
      logoUrl: string | null
      timezone: string
      accentColor: string | null
      accentColorLight: string | null
      preferredPaymentMethods: string[]
      publicBookingEnabled: boolean
      autoCheckinEnabled: boolean
      autoCheckinMessage: string | null
      brandName: string | null
      brandTagline: string | null
      clientPortalHeading: string | null
      clientWelcomeMessage: string | null
      cashappUsername: string | null
      venmoUsername: string | null
      paypalEmail: string | null
      zelleEmailOrPhone: string | null
      stripeConnected: boolean
      paymentInstructions: string | null
    }
    profile: {
      firstName: string
      lastName: string
      fullName: string | null
      bio: string | null
      phone: string | null
      avatarUrl: string | null
      email: string | null
      notifications: Record<NotificationKey, boolean>
    }
  }
}

function mediaUrlUnoptimized(url: string | null | undefined): boolean {
  if (!url) return false
  return url.startsWith('blob:') || url.startsWith('data:')
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const BIO_MAX = 300
const PAYMENT_INSTRUCTIONS_MAX = 300
const PAYMENT_METHODS = [
  { label: 'Cash', value: 'cash' },
  { label: 'Venmo', value: 'venmo' },
  { label: 'CashApp', value: 'cashapp' },
  { label: 'Zelle', value: 'zelle' },
  { label: 'PayPal', value: 'paypal' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
] as const

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
] as const

function Toggle({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-[18px] w-[32px] rounded-full transition-colors duration-150 ease-in ${
        checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
      }`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-[var(--color-bg)] transition-all duration-150 ease-in ${
          checked ? 'left-[16px]' : 'left-[2px]'
        }`}
      />
    </button>
  )
}

export function SettingsPageContent() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { updateSettings, refetchSettings } = useWorkspace()
  const [activeTab, setActiveTab] = useState<TabKey>('profile')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [profileAvatarUrl, setProfileAvatarUrl] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [bio, setBio] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceLogoUrl, setWorkspaceLogoUrl] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [preferredPaymentMethods, setPreferredPaymentMethods] = useState<string[]>([])
  const [brandName, setBrandName] = useState('')
  const [brandTagline, setBrandTagline] = useState('')
  const [clientPortalHeading, setClientPortalHeading] = useState('')
  const [clientWelcomeMessage, setClientWelcomeMessage] = useState('')
  const [driveFolderId, setDriveFolderId] = useState('')
  const [savingDrive, setSavingDrive] = useState(false)
  const [savingWorkspace, setSavingWorkspace] = useState(false)
  const [cashappUsername, setCashappUsername] = useState('')
  const [venmoUsername, setVenmoUsername] = useState('')
  const [paypalEmail, setPaypalEmail] = useState('')
  const [zelleEmailOrPhone, setZelleEmailOrPhone] = useState('')
  const [stripeConnected, setStripeConnected] = useState(false)
  const [paymentInstructions, setPaymentInstructions] = useState('')
  const [savingPayments, setSavingPayments] = useState(false)

  const [accentColor, setAccentColor] = useState<AccentColor>(PHASE4_DEFAULT_COACH_ACCENT)

  const [notifications, setNotifications] = useState<Record<NotificationKey, boolean>>({
    newMessage: true,
    sessionReminder: true,
    clientActivity: true,
    paymentReceived: true,
  })
  const [notificationSaved, setNotificationSaved] = useState<Record<NotificationKey, boolean>>({
    newMessage: false,
    sessionReminder: false,
    clientActivity: false,
    paymentReceived: false,
  })
  const saveDebounceRef = useRef<Partial<Record<NotificationKey, number>>>({})
  const saveFadeRef = useRef<Partial<Record<NotificationKey, number>>>({})

  const [autoCheckinEnabled, setAutoCheckinEnabled] = useState(false)
  const [autoCheckinMessage, setAutoCheckinMessage] = useState('')
  const [savingAutoCheckin, setSavingAutoCheckin] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/settings', { cache: 'no-store', credentials: 'include' })
        const json = (await res.json().catch(() => null)) as SettingsResponse | null
        if (!res.ok || !json?.data) {
          setError((json as { error?: string } | null)?.error ?? 'Could not load settings')
          return
        }
        if (!mounted) return
        setFirstName(json.data.profile.firstName || '')
        setLastName(json.data.profile.lastName || '')
        setBio(json.data.profile.bio || '')
        setPhone(json.data.profile.phone || '')
        setProfileAvatarUrl(json.data.profile.avatarUrl || '')
        setEmail(json.data.profile.email || '')
        setWorkspaceName(json.data.workspace.displayName || json.data.workspace.name || '')
        setWorkspaceLogoUrl(json.data.workspace.logoUrl || '')
        setTimezone(json.data.workspace.timezone || 'America/New_York')
        setPreferredPaymentMethods(json.data.workspace.preferredPaymentMethods || [])
        setBrandName(json.data.workspace.brandName || '')
        setBrandTagline(json.data.workspace.brandTagline || '')
        setClientPortalHeading(json.data.workspace.clientPortalHeading || '')
        setClientWelcomeMessage(json.data.workspace.clientWelcomeMessage || '')
        setCashappUsername(json.data.workspace.cashappUsername || '')
        setVenmoUsername(json.data.workspace.venmoUsername || '')
        setPaypalEmail(json.data.workspace.paypalEmail || '')
        setZelleEmailOrPhone(json.data.workspace.zelleEmailOrPhone || '')
        setStripeConnected(json.data.workspace.stripeConnected || false)
        setPaymentInstructions(json.data.workspace.paymentInstructions || '')
        const coercedAccent = coerceToAllowedCoachAccent(json.data.workspace.accentColor)
        setAccentColor(coercedAccent)
        const accentLightStored = json.data.workspace.accentColorLight?.trim()
        const lightForVars = accentLightStored || getAccentLight(coercedAccent)
        applyWorkspaceAccentVars(coercedAccent, lightForVars.toUpperCase())
        setNotifications({
          newMessage: json.data.profile.notifications.newMessage,
          sessionReminder: json.data.profile.notifications.sessionReminder,
          clientActivity: json.data.profile.notifications.clientActivity,
          paymentReceived: json.data.profile.notifications.paymentReceived,
        })
        setAutoCheckinEnabled(json.data.workspace.autoCheckinEnabled ?? false)
        setAutoCheckinMessage(json.data.workspace.autoCheckinMessage ?? '')
        // Load Drive folder ID from separate endpoint
        fetch('/api/workspaces/import-folder', { credentials: 'include' })
          .then((r) => r.json())
          .then((d: { folderId?: string | null }) => {
            if (mounted) setDriveFolderId(d.folderId ?? '')
          })
          .catch(() => {})
      } catch {
        setError('Something went wrong — check your connection and try again')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(t)
  }, [toast])

  const stripeReturnHandled = useRef(false)
  useEffect(() => {
    if (stripeReturnHandled.current) return
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    const err = sp.get('stripe_error')
    const ret = sp.get('stripe_return')
    const tab = sp.get('tab')
    if (tab === 'profile' || tab === 'workspace' || tab === 'payments' || tab === 'appearance' || tab === 'notifications') {
      setActiveTab(tab)
    }
    if (!err && !ret) return
    stripeReturnHandled.current = true

    if (ret === 'ready') {
      setToast('Stripe is connected. Clients can pay invoices by card.')
      setActiveTab('payments')
    } else if (ret === 'pending') {
      setToast('Stripe still needs more information — finish in the Stripe dashboard or click Connect Stripe again.')
      setActiveTab('payments')
    }

    if (err === 'owner_only') {
      setToast('Only the workspace owner can connect Stripe for card payments.')
    } else if (err === 'stripe_not_configured') {
      setToast('Stripe is not configured on this server.')
    } else if (err === 'rate_limited') {
      setToast('Too many attempts — wait a minute and try Connect Stripe again.')
    } else if (err) {
      setToast('Could not connect Stripe — try again or contact support.')
    }

    router.replace('/coach/settings', { scroll: false })
  }, [router])

  const disconnectStripe = async () => {
    setSavingPayments(true)
    try {
      const res = await fetch('/api/settings/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stripeConnected: false }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast(typeof json.error === 'string' ? json.error : 'Could not disconnect Stripe')
        return
      }
      setStripeConnected(false)
      setToast('Stripe disconnected for this workspace')
      void refetchSettings()
      router.refresh()
    } catch {
      setToast('Something went wrong — check your connection and try again')
    } finally {
      setSavingPayments(false)
    }
  }

  useEffect(() => {
    return () => {
      /* Refs hold mutable timeout-id maps; cleanup must snapshot .current at unmount (not at mount). */
      /* eslint-disable react-hooks/exhaustive-deps */
      const debounceTimeouts = saveDebounceRef.current
      const fadeTimeouts = saveFadeRef.current
      /* eslint-enable react-hooks/exhaustive-deps */
      Object.values(debounceTimeouts).forEach((id) => id && window.clearTimeout(id))
      Object.values(fadeTimeouts).forEach((id) => id && window.clearTimeout(id))
    }
  }, [])

  const uploadViaApi = async (file: File, type: 'avatar' | 'logo'): Promise<string> => {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error('Image must be under 5MB')
    }
    const form = new FormData()
    form.set('file', file)
    form.set('type', type)
    const res = await fetch('/api/upload', { method: 'POST', body: form, credentials: 'include' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(typeof json.error === 'string' ? json.error : 'Could not upload image')
    }
    const url = json.data?.url as string | undefined
    if (!url) throw new Error('Could not upload image')
    return url
  }

  const onAvatarFileChange = async (file: File | null) => {
    if (!file) return
    const previousUrl = profileAvatarUrl
    let blobPreview: string | null = null
    try {
      blobPreview = URL.createObjectURL(file)
      setProfileAvatarUrl(blobPreview)
      const url = await uploadViaApi(file, 'avatar')
      if (blobPreview.startsWith('blob:')) URL.revokeObjectURL(blobPreview)
      blobPreview = null
      setProfileAvatarUrl(url)

      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ avatarUrl: url }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Could not save profile photo')
      }
      setToast('Profile photo saved')
      void refetchSettings()
      router.refresh()
    } catch (e) {
      if (blobPreview?.startsWith('blob:')) URL.revokeObjectURL(blobPreview)
      setProfileAvatarUrl(previousUrl)
      setToast(e instanceof Error ? e.message : 'Could not update profile photo')
    }
  }

  const onWorkspaceLogoChange = async (file: File | null) => {
    if (!file) return
    const previousUrl = workspaceLogoUrl
    let blobPreview: string | null = null
    try {
      blobPreview = URL.createObjectURL(file)
      setWorkspaceLogoUrl(blobPreview)
      const url = await uploadViaApi(file, 'logo')
      if (blobPreview.startsWith('blob:')) URL.revokeObjectURL(blobPreview)
      blobPreview = null
      setWorkspaceLogoUrl(url)

      const res = await fetch('/api/settings/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ logoUrl: url }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Could not save workspace logo')
      }
      updateSettings({
        workspaceDisplayName: workspaceName.trim() || null,
        brandName: brandName.trim() || null,
        logoUrl: url,
      })
      setToast('Workspace logo saved')
      void refetchSettings()
      router.refresh()
    } catch (e) {
      if (blobPreview?.startsWith('blob:')) URL.revokeObjectURL(blobPreview)
      setWorkspaceLogoUrl(previousUrl)
      setToast(e instanceof Error ? e.message : 'Could not update workspace logo')
    }
  }

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          bio: bio.trim() || null,
          phone: phone.trim() || null,
          avatarUrl: profileAvatarUrl || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast(json.error ?? 'Could not save profile')
        return
      }
      setToast('Profile saved')
      void refetchSettings()
      router.refresh()
    } catch {
      setToast('Something went wrong — check your connection and try again')
    } finally {
      setSavingProfile(false)
    }
  }

  const saveWorkspace = async () => {
    setSavingWorkspace(true)
    try {
      const res = await fetch('/api/settings/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          // Empty string fails zod .min(1); use null so branding-only saves still persist.
          displayName: workspaceName.trim().length > 0 ? workspaceName.trim() : null,
          timezone,
          logoUrl: workspaceLogoUrl || null,
          preferredPaymentMethods,
          brandName: brandName.trim().length > 0 ? brandName.trim() : null,
          brandTagline: brandTagline.trim().length > 0 ? brandTagline.trim() : null,
          clientPortalHeading: clientPortalHeading.trim().length > 0 ? clientPortalHeading.trim() : null,
          clientWelcomeMessage: clientWelcomeMessage.trim().length > 0 ? clientWelcomeMessage.trim() : null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast(json.error ?? 'Could not save workspace settings')
        return
      }

      updateSettings({
        workspaceDisplayName: workspaceName.trim() || null,
        brandName: brandName.trim() || null,
        logoUrl: workspaceLogoUrl || null,
      })
      setToast('Workspace settings saved')
      void refetchSettings()
      router.refresh()
    } catch {
      setToast('Something went wrong — check your connection and try again')
    } finally {
      setSavingWorkspace(false)
    }
  }

  const savePaymentSettings = async () => {
    setSavingPayments(true)
    try {
      const res = await fetch('/api/settings/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cashappUsername: cashappUsername.trim() || null,
          venmoUsername: venmoUsername.trim() || null,
          paypalEmail: paypalEmail.trim() || null,
          zelleEmailOrPhone: zelleEmailOrPhone.trim() || null,
          stripeConnected,
          paymentInstructions: paymentInstructions.trim() || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast(json.error ?? 'Could not save payment settings')
        return
      }
      setToast('Payment settings saved')
      router.refresh()
    } catch {
      setToast('Something went wrong — check your connection and try again')
    } finally {
      setSavingPayments(false)
    }
  }

  const saveCoachAccent = async (hex: AccentColor) => {
    const res = await fetch('/api/coach/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accentColor: hex }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(typeof json.error === 'string' ? json.error : 'Save failed')
    }
    const light = getAccentLight(hex).toUpperCase()
    setAccentColor(hex)
    updateSettings({ accentColor: hex, accentColorLight: light })
    applyWorkspaceAccentVars(hex, light)
    setToast('Accent saved')
    void refetchSettings()
    router.refresh()
  }

  const saveNotification = (key: NotificationKey, nextValue: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: nextValue }))
    const existing = saveDebounceRef.current[key]
    if (existing) window.clearTimeout(existing)

    saveDebounceRef.current[key] = window.setTimeout(async () => {
      const payload: Record<string, boolean> = {}
      if (key === 'newMessage') payload.newMessage = nextValue
      if (key === 'sessionReminder') payload.sessionReminder = nextValue
      if (key === 'clientActivity') payload.clientActivity = nextValue
      if (key === 'paymentReceived') payload.paymentReceived = nextValue

      const res = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast(json.error ?? 'Could not save notification settings')
        return
      }
      setNotificationSaved((prev) => ({ ...prev, [key]: true }))
      const oldFade = saveFadeRef.current[key]
      if (oldFade) window.clearTimeout(oldFade)
      saveFadeRef.current[key] = window.setTimeout(
        () => setNotificationSaved((prev) => ({ ...prev, [key]: false })),
        2000
      )
    }, 500)
  }

  const updatePassword = async () => {
    setSavingPassword(true)
    setPasswordStatus(null)
    try {
      const res = await fetch('/api/settings/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPasswordStatus({ ok: false, message: json.error ?? 'Could not update password' })
        return
      }
      setPasswordStatus({ ok: true, message: 'Password updated successfully' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setPasswordStatus({ ok: false, message: 'Something went wrong — check your connection and try again' })
    } finally {
      setSavingPassword(false)
    }
  }

  const deleteAccount = async () => {
    setDeletingAccount(true)
    try {
      const res = await fetch('/api/settings/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirm: deleteConfirmInput }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setToast(json.error ?? 'Could not delete account')
        return
      }
      await supabase.auth.signOut()
      window.location.href = `${window.location.origin}/login?deleted=true`
    } catch {
      setToast('Something went wrong — check your connection and try again')
    } finally {
      setDeletingAccount(false)
    }
  }

  const tabButtonClass = (key: TabKey) =>
    cn(
      'min-h-10 shrink-0 rounded-[var(--radius-md)] px-3 py-2.5 text-left text-[13px] font-medium transition-colors duration-[80ms] max-lg:whitespace-nowrap lg:w-full',
      activeTab === key
        ? 'bg-[var(--cp-offwhite)] text-[var(--cp-accent)] shadow-[var(--shadow-xs)]'
        : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]'
    )

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title="Settings" />
        <div className="space-y-4 animate-pulse">
          <div className="h-10 w-full max-w-[200px] rounded-lg bg-[var(--border-default)]" />
          <div className="h-64 w-full max-w-xl rounded-lg bg-[var(--border-default)]" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title="Settings" />
        <Card className="max-w-2xl">
          <p className="text-[var(--text-primary)]">{error}</p>
          <Button className="mt-4" variant="secondary" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title="Settings" />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <nav
            className="flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)] pb-2 lg:w-[200px] lg:shrink-0 lg:flex-col lg:overflow-visible lg:border-b-0 lg:pb-0"
            aria-label="Settings sections"
          >
            <button type="button" className={tabButtonClass('profile')} onClick={() => setActiveTab('profile')}>
              Profile
            </button>
            <button type="button" className={tabButtonClass('workspace')} onClick={() => setActiveTab('workspace')}>
              Workspace
            </button>
            <button type="button" className={tabButtonClass('payments')} onClick={() => setActiveTab('payments')}>
              Payments
            </button>
            <button type="button" className={tabButtonClass('appearance')} onClick={() => setActiveTab('appearance')}>
              Appearance
            </button>
            <button type="button" className={tabButtonClass('notifications')} onClick={() => setActiveTab('notifications')}>
              Notifications
            </button>
          </nav>

          <div className="min-w-0 flex-1 lg:max-w-[600px]">
        {activeTab === 'profile' && (
          <div className="space-y-8">
            <Card className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Avatar</label>
                <div className="flex items-center gap-4">
                  <div className="relative h-24 w-24 overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]">
                    {profileAvatarUrl ? (
                      <Image
                        src={profileAvatarUrl}
                        alt="Avatar preview"
                        fill
                        className="object-cover"
                        sizes="96px"
                        unoptimized={mediaUrlUnoptimized(profileAvatarUrl)}
                      />
                    ) : null}
                  </div>
                  <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 text-sm font-medium">
                    Upload avatar
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => onAvatarFileChange(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">First name</label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Last name</label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Bio</label>
                <Textarea value={bio} maxLength={BIO_MAX} onChange={(e) => setBio(e.target.value)} />
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{bio.length}/{BIO_MAX}</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <Input value={email} readOnly />
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">To change your email contact support</p>
              </div>

              <Button onClick={saveProfile} disabled={savingProfile}>{savingProfile ? 'Saving profile...' : 'Save profile'}</Button>
            </Card>

            <Card className="space-y-4">
              <h2 className="text-lg font-medium">Change password</h2>
              <div>
                <label className="mb-1 block text-sm font-medium">Current password</label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">New password</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Confirm new password</label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              <Button onClick={updatePassword} disabled={savingPassword}>{savingPassword ? 'Updating password...' : 'Update password'}</Button>
              {passwordStatus && (
                <p className={`text-sm ${passwordStatus.ok ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                  {passwordStatus.message}
                </p>
              )}
            </Card>

            <Card className="border-[var(--color-error)] space-y-3">
              <h2 className="text-lg font-medium text-[var(--color-error)]">Danger zone</h2>
              <Button variant="destructive-secondary" onClick={() => setDeleteModalOpen(true)}>
                Delete account
              </Button>
            </Card>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-8 max-w-3xl">
            <Card className="space-y-2">
              <h2 className="text-lg font-medium">How clients pay you</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Add your payment details so clients see exactly how to send money when they receive an invoice.
              </p>
            </Card>

            <Card className="space-y-4 border border-[var(--color-border)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold text-[#635BFF]">Stripe</span>
                <span className="rounded-full border border-[var(--color-accent)] bg-[var(--color-accent-light)] px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
                  Recommended
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stripeConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'}`}>
                  {stripeConnected ? 'Connected' : 'Not connected'}
                </span>
              </div>
              {!stripeConnected ? (
                <div className="space-y-3">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Accept card payments directly through Kindo. Clients pay instantly - no back and forth.
                  </p>
                  <ul className="space-y-1 text-sm text-[var(--color-text-secondary)]">
                    <li>✓ Clients pay on Stripe Checkout</li>
                    <li>✓ Invoices marked paid when checkout completes</li>
                    <li>✓ Revenue tracked in Kindo</li>
                  </ul>
                  <a href="/api/billing/stripe-connect">
                    <Button type="button">Connect Stripe</Button>
                  </a>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href="https://dashboard.stripe.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-[var(--color-accent)] hover:underline"
                  >
                    Manage in Stripe →
                  </a>
                  <a
                    href="/api/billing/stripe-connect"
                    className="text-sm font-medium text-[var(--color-accent)] hover:underline"
                  >
                    Update payout account
                  </a>
                  <Button
                    variant="ghost"
                    className="text-sm"
                    disabled={savingPayments}
                    onClick={() => void disconnectStripe()}
                  >
                    {savingPayments ? 'Disconnecting…' : 'Disconnect'}
                  </Button>
                </div>
              )}
            </Card>

            <Card className="space-y-4">
              <div>
                <h3 className="text-base font-medium">Manual payment methods</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Add your handles so clients know where to send payment.
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 flex items-center gap-2 text-sm font-medium">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700">$</span>
                    CashApp
                  </label>
                  <Input value={cashappUsername} onChange={(e) => setCashappUsername(e.target.value)} placeholder="$yourcashtag" />
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Your $Cashtag username</p>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-2 text-sm font-medium">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-700">V</span>
                    Venmo
                  </label>
                  <Input value={venmoUsername} onChange={(e) => setVenmoUsername(e.target.value)} placeholder="@yourvenmo" />
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Your @username</p>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-2 text-sm font-medium">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700">P</span>
                    PayPal
                  </label>
                  <Input value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} placeholder="your@email.com" />
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Email address or PayPal.me link</p>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-2 text-sm font-medium">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-700">Z</span>
                    Zelle
                  </label>
                  <Input value={zelleEmailOrPhone} onChange={(e) => setZelleEmailOrPhone(e.target.value)} placeholder="Phone or email" />
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Phone number or email registered with Zelle</p>
                </div>
              </div>
            </Card>

            <Card className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Payment note to clients</label>
                <Textarea
                  value={paymentInstructions}
                  maxLength={PAYMENT_INSTRUCTIONS_MAX}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                  placeholder="e.g. Please send payment within 24 hours. Include your name in the memo."
                />
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {paymentInstructions.length}/{PAYMENT_INSTRUCTIONS_MAX}
                </p>
              </div>
              <Button onClick={savePaymentSettings} disabled={savingPayments}>
                {savingPayments ? 'Saving payment settings...' : 'Save payment settings'}
              </Button>
            </Card>
          </div>
        )}

        {activeTab === 'workspace' && (
          <div className="space-y-8 max-w-3xl">
            <Card className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Workspace name</label>
                <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Logo</label>
                <label className="relative flex h-[80px] w-[240px] cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                  {workspaceLogoUrl ? (
                    <Image
                      src={workspaceLogoUrl}
                      alt="Workspace logo preview"
                      fill
                      className="object-contain p-1"
                      sizes="240px"
                      unoptimized={mediaUrlUnoptimized(workspaceLogoUrl)}
                    />
                  ) : (
                    <span className="text-xs text-[var(--color-text-secondary)]">Upload logo</span>
                  )}
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => onWorkspaceLogoChange(e.target.files?.[0] ?? null)} />
                </label>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-[15px]"
                >
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Preferred payment methods</label>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHODS.map((method) => {
                    const selected = preferredPaymentMethods.includes(method.value)
                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => {
                          setPreferredPaymentMethods((prev) =>
                            selected ? prev.filter((v) => v !== method.value) : [...prev, method.value]
                          )
                        }}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                          selected
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                            : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)]'
                        }`}
                      >
                        {method.label}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  This shows clients how to pay when they receive an invoice.
                </p>
              </div>

              <WorkspaceStorageSection />

              <div className="border-t border-[var(--color-border)] pt-6">
                <h2 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">Google Drive</h2>
                <div>
                  <label className="mb-1 block text-sm font-medium">Import folder ID</label>
                  <div className="flex gap-2">
                    <Input
                      value={driveFolderId}
                      onChange={(e) => setDriveFolderId(e.target.value)}
                      placeholder="e.g. 1AbC_xYz..."
                      className="flex-1"
                    />
                    <Button
                      disabled={savingDrive}
                      loading={savingDrive}
                      onClick={async () => {
                        setSavingDrive(true)
                        try {
                          const res = await fetch('/api/workspaces/import-folder', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ folderId: driveFolderId.trim() || null }),
                          })
                          setToast(res.ok ? 'Drive folder saved' : 'Could not save folder')
                        } catch {
                          setToast('Could not save folder — check your connection')
                        } finally {
                          setSavingDrive(false)
                        }
                      }}
                    >
                      Save
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Videos uploaded to this Google Drive folder will auto-import into your library. Find the folder ID in the Drive URL after /folders/.
                  </p>
                </div>
              </div>

              <div className="border-t border-[var(--color-border)] pt-6">
                <h2 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">Client branding</h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Your brand name</label>
                    <Input
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="Peak Performance Coaching"
                    />
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      What your clients see when they log in
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Tagline (optional)</label>
                    <Input
                      value={brandTagline}
                      maxLength={100}
                      onChange={(e) => setBrandTagline(e.target.value)}
                      placeholder="Transform your performance"
                    />
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {brandTagline.length}/100
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Portal heading (optional)</label>
                    <Input
                      value={clientPortalHeading}
                      onChange={(e) => setClientPortalHeading(e.target.value)}
                      placeholder="Welcome to [your brand]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Welcome message (optional)</label>
                    <Textarea
                      value={clientWelcomeMessage}
                      maxLength={200}
                      onChange={(e) => setClientWelcomeMessage(e.target.value)}
                      placeholder="A short message for your clients when they first log in"
                    />
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {clientWelcomeMessage.length}/200
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={saveWorkspace} disabled={savingWorkspace}>
                {savingWorkspace ? 'Saving workspace...' : 'Save workspace'}
              </Button>
            </Card>

            <Card className="space-y-4">
              <CustomDomainSection />
            </Card>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="max-w-5xl space-y-8">
            <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[13px] leading-snug text-[var(--color-text-secondary)]">
              <span className="font-medium text-[var(--color-text-primary)]">Dark mode:</span> use the sun/moon toggle in the top bar.
              Accent color is saved to your workspace and applies to buttons, nav, focus rings, and your client portal (message bubbles stay brand sapphire).
            </p>
            <div className="rounded-[12px] border border-[var(--cp-border)] bg-[var(--cp-white)] p-6">
              <AccentColorPicker currentAccent={accentColor} onSave={saveCoachAccent} />
            </div>
            <p className="text-[13px] text-[var(--text-tertiary)]">
              <Link href="/coach/settings/appearance" className="text-[var(--cp-accent)] underline-offset-2 hover:underline">
                Open appearance-only page
              </Link>
            </p>
            <div className="pt-2">
              <div className="w-[200px] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--cp-offwhite)] p-3">
                <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
                  <span className="inline-flex size-5 rounded-[6px]" style={{ backgroundColor: accentColor }} />
                  <span className="truncate text-[12px] font-medium text-[var(--text-primary)]">{brandName.trim() || 'Kindo'}</span>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="h-5 rounded-[6px]" style={{ backgroundColor: 'var(--accent-light)' }} />
                  <div className="h-5 rounded-[6px] bg-[var(--bg-muted)]" />
                  <div className="h-5 rounded-[6px] bg-[var(--bg-muted)]" />
                </div>
                <p className="mt-3 text-center text-[10px] text-[var(--text-quaternary)]">Powered by Kindo</p>
              </div>
              <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">Preview — how clients see your portal</p>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-8 max-w-3xl">
            <Card className="space-y-4">
              {[
                {
                  key: 'newMessage' as const,
                  title: 'New message from client',
                  description: 'Get notified when a client sends you a message',
                },
                {
                  key: 'sessionReminder' as const,
                  title: 'Session reminders',
                  description: 'Reminders 24 hours before each session',
                },
                {
                  key: 'clientActivity' as const,
                  title: 'Client activity',
                  description: 'When a client completes a program module',
                },
                {
                  key: 'paymentReceived' as const,
                  title: 'Payment received',
                  description: "When a client's invoice is marked as paid",
                },
              ].map((row) => (
                <div key={row.key} className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">{row.title}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{row.description}</p>
                    {notificationSaved[row.key] ? (
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Saved</p>
                    ) : null}
                  </div>
                  <Toggle checked={notifications[row.key]} onChange={(next) => saveNotification(row.key, next)} />
                </div>
              ))}
            </Card>

            <Card className="space-y-4">
              <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Automated client check-ins</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Automatically send a check-in message when a client hasn&apos;t been active for 14 days. The message
                appears to come from you.
              </p>
              <div className="flex items-start justify-between gap-4">
                <span className="font-medium">Auto check-in inactive clients</span>
                <Toggle
                  checked={autoCheckinEnabled}
                  onChange={(next) => setAutoCheckinEnabled(next)}
                />
              </div>
              {autoCheckinEnabled ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                    Check-in message
                  </label>
                  <Textarea
                    rows={6}
                    value={autoCheckinMessage}
                    onChange={(e) => setAutoCheckinMessage(e.target.value)}
                    placeholder={DEFAULT_AUTO_CHECKIN_MESSAGE}
                    className="font-normal"
                  />
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Use {'{firstName}'} for the client&apos;s first name. If empty, the default template is used.
                  </p>
                </div>
              ) : null}
              <Button
                type="button"
                disabled={savingAutoCheckin}
                onClick={async () => {
                  setSavingAutoCheckin(true)
                  try {
                    const res = await fetch('/api/settings/notifications', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({
                        autoCheckinEnabled,
                        autoCheckinMessage: autoCheckinMessage.trim() || null,
                      }),
                    })
                    const json = await res.json().catch(() => ({}))
                    if (!res.ok) {
                      setToast(json.error ?? 'Could not save check-in settings')
                      return
                    }
                    setToast('Check-in settings saved')
                    void refetchSettings()
                  } catch {
                    setToast('Something went wrong — try again')
                  } finally {
                    setSavingAutoCheckin(false)
                  }
                }}
              >
                {savingAutoCheckin ? 'Saving…' : 'Save check-in settings'}
              </Button>
            </Card>
          </div>
        )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          if (!deletingAccount) setDeleteModalOpen(false)
        }}
        title="Delete account"
        className="w-full max-w-none md:max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-primary)]">
            This will permanently delete your workspace and all client data. This cannot be undone.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium">Type DELETE MY ACCOUNT to confirm</label>
            <Input value={deleteConfirmInput} onChange={(e) => setDeleteConfirmInput(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)} disabled={deletingAccount}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={deleteAccount}
              disabled={deleteConfirmInput !== 'DELETE MY ACCOUNT' || deletingAccount}
            >
              {deletingAccount ? 'Deleting account...' : 'Delete my account'}
            </Button>
          </div>
        </div>
      </Modal>

      {toast ? <div className="toast-coach">{toast}</div> : null}
    </>
  )
}
