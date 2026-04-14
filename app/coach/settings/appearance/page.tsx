'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTheme } from '@/components/ThemeProvider'
import { AccentColorPicker } from '@/components/settings/AccentColorPicker'
import type { AccentColor } from '@/types/coach'
import { coerceToAllowedCoachAccent, PHASE4_DEFAULT_COACH_ACCENT } from '@/lib/coach-accent-phase4'
import { applyWorkspaceAccentVars, getAccentLight } from '@/lib/accent-colors'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '@/lib/workspace-context'
import { STANCES, findStance, DEFAULT_STANCE_ID, type StanceId } from '@/lib/stances'

export default function CoachAppearancePage() {
  const router = useRouter()
  const { settings, updateSettings, refetchSettings } = useWorkspace()
  const { theme, setTheme } = useTheme()

  // Stance state
  const [selectedStance, setSelectedStance] = useState<StanceId>(
    (settings.stanceId as StanceId) || DEFAULT_STANCE_ID
  )
  const [stanceSaving, setStanceSaving] = useState(false)
  const [stanceSaved, setStanceSaved] = useState(false)

  // Ambient effects state
  const [ambientEnabled, setAmbientEnabled] = useState(false)
  useEffect(() => {
    try {
      setAmbientEnabled(localStorage.getItem('clearpath-ambient-particles') !== 'false')
    } catch { /* ignore */ }
  }, [])

  const toggleAmbient = () => {
    const next = !ambientEnabled
    setAmbientEnabled(next)
    try {
      localStorage.setItem('clearpath-ambient-particles', next ? 'true' : 'false')
    } catch { /* ignore */ }
    // Dispatch storage event for cross-component reactivity
    window.dispatchEvent(new StorageEvent('storage', { key: 'clearpath-ambient-particles', newValue: next ? 'true' : 'false' }))
  }

  // Accent color state
  const [accentColor, setAccentColor] = useState<AccentColor>(PHASE4_DEFAULT_COACH_ACCENT)
  const [accentLoading, setAccentLoading] = useState(true)

  // Brand identity state
  const [workspaceDisplayName, setWorkspaceDisplayName] = useState('')
  const [brandTagline, setBrandTagline] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [brandLoading, setBrandLoading] = useState(true)
  const [brandSaving, setBrandSaving] = useState(false)
  const [brandSaved, setBrandSaved] = useState(false)
  const [brandError, setBrandError] = useState<string | null>(null)
  const [logoImgError, setLogoImgError] = useState(false)

  // Fetch accent color
  useEffect(() => {
    let cancelled = false
    void fetch('/api/coach/settings', { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        const data = (await r.json().catch(() => null)) as { accentColor?: string } | null
        if (cancelled || !data?.accentColor) return
        const coerced = coerceToAllowedCoachAccent(data.accentColor)
        setAccentColor(coerced)
        document.documentElement.style.setProperty('--cp-accent', coerced)
        const light = getAccentLight(coerced).toUpperCase()
        applyWorkspaceAccentVars(coerced, light)
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setAccentLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Fetch brand identity fields
  useEffect(() => {
    let cancelled = false
    void fetch('/api/settings', { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        const json = (await r.json().catch(() => null)) as {
          data?: {
            workspace?: {
              displayName?: string | null
              brandTagline?: string | null
              logoUrl?: string | null
            }
          }
        } | null
        if (cancelled) return
        if (json?.data?.workspace?.displayName) setWorkspaceDisplayName(json.data.workspace.displayName)
        if (json?.data?.workspace?.brandTagline) setBrandTagline(json.data.workspace.brandTagline)
        if (json?.data?.workspace?.logoUrl) setLogoUrl(json.data.workspace.logoUrl)
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setBrandLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Reset logo image error when URL changes
  useEffect(() => {
    setLogoImgError(false)
  }, [logoUrl])

  const handleAccentSave = async (hex: AccentColor) => {
    const res = await fetch('/api/coach/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accentColor: hex }),
    })
    if (!res.ok) throw new Error('Save failed')
    const light = getAccentLight(hex).toUpperCase()
    setAccentColor(hex)
    updateSettings({ accentColor: hex, accentColorLight: light })
    applyWorkspaceAccentVars(hex, light)
    void refetchSettings()
    router.refresh()
  }

  const handleBrandSave = async () => {
    setBrandSaving(true)
    setBrandError(null)
    try {
      const res = await fetch('/api/settings/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: workspaceDisplayName || null,
          brandTagline: brandTagline || null,
          logoUrl: logoUrl || null,
        }),
      })
      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(errJson?.error ?? 'Save failed')
      }
      updateSettings({
        workspaceDisplayName: workspaceDisplayName || null,
        brandName: workspaceDisplayName || null,
        logoUrl: logoUrl || null,
      })
      setBrandSaved(true)
      setTimeout(() => setBrandSaved(false), 2500)
      router.refresh()
    } catch (err) {
      setBrandError(err instanceof Error ? err.message : 'Could not save. Please try again.')
    } finally {
      setBrandSaving(false)
    }
  }

  const handleStanceSelect = async (id: StanceId) => {
    setSelectedStance(id)

    // Apply CSS variables immediately for live preview
    const stance = findStance(id)
    const root = document.documentElement
    root.style.setProperty('--accent', stance.accent)
    root.style.setProperty('--accent-hover', stance.accentHover)
    root.style.setProperty('--accent-light', stance.accentLight)
    root.style.setProperty('--accent-muted', stance.accentMuted)
    root.style.setProperty('--text-on-accent', stance.textOnAccent)
    root.style.setProperty('--cp-accent', stance.accent)
    root.style.setProperty('--got-gold', stance.accent)
    root.style.setProperty('--got-gold-dim', stance.sectionLabelColor)
    root.style.setProperty('--coach-sidebar-bg', stance.sidebarBg)
    root.style.setProperty('--coach-sidebar-border', stance.sidebarBorder)
    root.style.setProperty('--coach-sidebar-hover', stance.sidebarHover)
    root.style.setProperty('--coach-sidebar-label', stance.sectionLabelColor)

    // Save to server
    setStanceSaving(true)
    try {
      const res = await fetch('/api/coach/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stanceId: id }),
      })
      if (!res.ok) throw new Error('Save failed')
      updateSettings({ stanceId: id, accentColor: stance.accent })
      setStanceSaved(true)
      setTimeout(() => setStanceSaved(false), 2000)
      void refetchSettings()
      router.refresh()
    } catch {
      // Revert on failure
      const prev = findStance(settings.stanceId)
      root.style.setProperty('--accent', prev.accent)
      root.style.setProperty('--cp-accent', prev.accent)
      setSelectedStance((settings.stanceId as StanceId) || DEFAULT_STANCE_ID)
    } finally {
      setStanceSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg-app)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[640px]">
        <nav className="mb-6">
          <Link
            href="/coach/settings"
            className="text-[13px] text-[var(--got-gold)] hover:underline underline-offset-2"
          >
            ← Settings
          </Link>
        </nav>

        <h1 className="font-display mb-1 text-[24px] font-medium tracking-[0.01em] text-[var(--text-primary)]">
          Appearance
        </h1>
        <p className="mb-8 text-[14px] text-[var(--text-tertiary)]">
          Make your workspace feel like yours. Changes are visible to you and your clients.
        </p>

        {/* ─── Section: Stance ─── */}
        <div className="mb-6 overflow-hidden rounded-[14px] border border-[rgba(255,250,240,0.04)] bg-[var(--bg-subtle)]">
          <div className="border-b border-[var(--border-subtle)] px-5 py-4">
            <h2 className="font-display text-[15px] font-medium text-[var(--text-primary)]">Stance</h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-tertiary)]">
              Choose a visual theme inspired by the regions of Tsushima. This changes your accent color, sidebar, and overall feel.
            </p>
          </div>

          <div className="px-5 py-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {STANCES.map((stance) => {
                const isSelected = selectedStance === stance.id
                return (
                  <button
                    key={stance.id}
                    type="button"
                    disabled={stanceSaving}
                    onClick={() => void handleStanceSelect(stance.id as StanceId)}
                    className={[
                      'group relative flex flex-col overflow-hidden rounded-[12px] border-2 text-left transition-all duration-300',
                      isSelected
                        ? 'border-[var(--got-gold)] shadow-[0_0_0_1px_rgba(196,164,74,0.2)]'
                        : 'border-[var(--border-default)] hover:border-[var(--border-strong)]',
                      stanceSaving ? 'opacity-70 pointer-events-none' : '',
                    ].join(' ')}
                  >
                    {/* Color preview strip */}
                    <div className="flex h-10 items-center gap-0">
                      <div className="h-full flex-1" style={{ background: stance.sidebarBg }} />
                      <div className="h-full flex-1" style={{ background: stance.accent }} />
                      <div className="h-full flex-1" style={{ background: stance.sectionLabelColor }} />
                      <div className="h-full flex-1" style={{ background: stance.accentHover }} />
                    </div>

                    <div className="flex flex-1 flex-col gap-1 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-[14px] font-medium text-[var(--text-primary)]">
                          {stance.label}
                        </span>
                        {isSelected && (
                          <span
                            className="flex size-[18px] items-center justify-center rounded-full text-[10px]"
                            style={{ background: stance.accent, color: stance.textOnAccent }}
                          >
                            ✓
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-quaternary)]">
                        {stance.region}
                      </span>
                      <span className="text-[12px] text-[var(--text-tertiary)]">
                        {stance.description}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
            {stanceSaved && (
              <p className="mt-3 text-[12px] font-medium text-[var(--success)]">Stance saved</p>
            )}
          </div>
        </div>

        {/* ─── Section: Ambient Effects ─── */}
        <div className="mb-6 overflow-hidden rounded-[14px] border border-[rgba(255,250,240,0.04)] bg-[var(--bg-subtle)]">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="font-display text-[15px] font-medium text-[var(--text-primary)]">Ambient effects</h2>
              <p className="mt-0.5 text-[13px] text-[var(--text-tertiary)]">
                Subtle floating particles that match your stance theme. Disabled on mobile.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleAmbient}
              role="switch"
              aria-checked={ambientEnabled}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200"
              style={{
                background: ambientEnabled ? 'var(--got-gold)' : 'var(--bg-emphasis)',
              }}
            >
              <span
                className="pointer-events-none inline-block size-4 rounded-full shadow-sm transition-transform duration-200"
                style={{
                  background: ambientEnabled ? 'var(--got-ink)' : 'var(--text-tertiary)',
                  transform: ambientEnabled ? 'translateX(22px)' : 'translateX(2px)',
                }}
              />
            </button>
          </div>
        </div>

        {/* ─── Section A: Theme ─── */}
        <div className="mb-6 overflow-hidden rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-subtle)]">
          <div className="border-b border-[var(--border-subtle)] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Theme</h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-tertiary)]">
              Switch between light and dark mode. Your preference is saved to this device.
            </p>
          </div>

          <div className="px-5 py-5">
            <div className="grid grid-cols-2 gap-3">
              {/* Light option */}
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={[
                  'flex flex-col overflow-hidden rounded-[10px] border-2 transition-colors duration-150',
                  theme === 'light' ? 'border-[var(--cp-accent)]' : 'border-[var(--border-default)] hover:border-[var(--border-strong)]',
                ].join(' ')}
              >
                <div className="flex h-[80px] overflow-hidden">
                  <div className="flex w-10 flex-col gap-1.5 bg-[#ebebeb] px-2 py-2.5">
                    <div className="h-2 w-full rounded-sm bg-[#c4c4c4]" />
                    <div className="h-2 w-full rounded-sm" style={{ backgroundColor: accentColor }} />
                    <div className="h-2 w-full rounded-sm bg-[#c4c4c4]" />
                    <div className="h-2 w-full rounded-sm bg-[#c4c4c4]" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 bg-[#f7f7f7] px-3 py-2.5">
                    <div className="h-2.5 w-20 rounded-full bg-[#dcdcdc]" />
                    <div className="h-2 w-16 rounded-full bg-[#e6e6e6]" />
                    <div className="mt-0.5 h-6 w-full rounded-[6px] bg-[#f0f0f0] border border-[#dcdcdc]" />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2">
                  <span className="text-[13px] font-medium text-[var(--text-primary)]">Light</span>
                  <span
                    className="flex size-[18px] items-center justify-center rounded-full text-[10px]"
                    style={{
                      background: theme === 'light' ? accentColor : 'var(--bg-muted)',
                      color: theme === 'light' ? '#fff' : 'transparent',
                      border: theme === 'light' ? 'none' : '1.5px solid var(--border-strong)',
                    }}
                  >
                    {theme === 'light' && '✓'}
                  </span>
                </div>
              </button>

              {/* Dark option */}
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={[
                  'flex flex-col overflow-hidden rounded-[10px] border-2 transition-colors duration-150',
                  theme === 'dark' ? 'border-[var(--cp-accent)]' : 'border-[var(--border-default)] hover:border-[var(--border-strong)]',
                ].join(' ')}
              >
                <div className="flex h-[80px] overflow-hidden">
                  <div className="flex w-10 flex-col gap-1.5 bg-[#1c1c1c] px-2 py-2.5">
                    <div className="h-2 w-full rounded-sm bg-[#303030]" />
                    <div className="h-2 w-full rounded-sm" style={{ backgroundColor: accentColor }} />
                    <div className="h-2 w-full rounded-sm bg-[#303030]" />
                    <div className="h-2 w-full rounded-sm bg-[#303030]" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 bg-[#111111] px-3 py-2.5">
                    <div className="h-2.5 w-20 rounded-full bg-[#2c2c2c]" />
                    <div className="h-2 w-16 rounded-full bg-[#262626]" />
                    <div className="mt-0.5 h-6 w-full rounded-[6px] bg-[#1c1c1c] border border-[#2c2c2c]" />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-[#2c2c2c] bg-[#1c1c1c] px-3 py-2">
                  <span className="text-[13px] font-medium text-[#f2f2f2]">Dark</span>
                  <span
                    className="flex size-[18px] items-center justify-center rounded-full text-[10px]"
                    style={{
                      background: theme === 'dark' ? accentColor : '#262626',
                      color: theme === 'dark' ? '#fff' : 'transparent',
                      border: theme === 'dark' ? 'none' : '1.5px solid #3c3c3c',
                    }}
                  >
                    {theme === 'dark' && '✓'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* ─── Section B: Brand Identity ─── */}
        <div className="mb-6 overflow-hidden rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-subtle)]">
          <div className="border-b border-[var(--border-subtle)] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Brand Identity</h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-tertiary)]">
              Your workspace name, tagline, and logo — shown in the client portal navigation header.
            </p>
          </div>

          <div className="px-5 py-5">
            {brandLoading ? (
              <div className="flex h-20 items-center justify-center">
                <div
                  style={{
                    width: 20,
                    height: 20,
                    border: '2px solid var(--border-default)',
                    borderTopColor: 'var(--cp-accent)',
                    borderRadius: '50%',
                    animation: 'cp-spin 0.7s linear infinite',
                  }}
                />
              </div>
            ) : (
              <>
                {/* Workspace display name */}
                <div className="mb-4">
                  <label
                    htmlFor="workspace-display-name"
                    className="mb-1.5 block text-[13px] font-medium text-[var(--text-primary)]"
                  >
                    Workspace display name
                    <span className="ml-1.5 text-[12px] font-normal text-[var(--text-quaternary)]">
                      {workspaceDisplayName.length}/40
                    </span>
                  </label>
                  <input
                    id="workspace-display-name"
                    type="text"
                    value={workspaceDisplayName}
                    onChange={(e) => {
                      if (e.target.value.length <= 40) setWorkspaceDisplayName(e.target.value)
                    }}
                    maxLength={40}
                    placeholder="e.g. Apex Coaching"
                    className="w-full rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none focus:border-[var(--cp-accent)] focus:ring-1 focus:ring-[var(--cp-accent)]"
                  />
                </div>

                {/* Brand tagline */}
                <div className="mb-4">
                  <label
                    htmlFor="brand-tagline"
                    className="mb-1.5 block text-[13px] font-medium text-[var(--text-primary)]"
                  >
                    Brand tagline
                    <span className="ml-1.5 text-[12px] font-normal text-[var(--text-quaternary)]">
                      {brandTagline.length}/80
                    </span>
                  </label>
                  <input
                    id="brand-tagline"
                    type="text"
                    value={brandTagline}
                    onChange={(e) => {
                      if (e.target.value.length <= 80) setBrandTagline(e.target.value)
                    }}
                    maxLength={80}
                    placeholder="e.g. Elite performance coaching"
                    className="w-full rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none focus:border-[var(--cp-accent)] focus:ring-1 focus:ring-[var(--cp-accent)]"
                  />
                  <p className="mt-1 text-[12px] text-[var(--text-quaternary)]">
                    Shown under your brand name in the client portal nav.
                  </p>
                </div>

                {/* Logo URL */}
                <div className="mb-5">
                  <label
                    htmlFor="logo-url"
                    className="mb-1.5 block text-[13px] font-medium text-[var(--text-primary)]"
                  >
                    Logo URL
                  </label>
                  <input
                    id="logo-url"
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="w-full rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none focus:border-[var(--cp-accent)] focus:ring-1 focus:ring-[var(--cp-accent)]"
                  />
                  <p className="mt-1 text-[12px] text-[var(--text-quaternary)]">
                    Paste a public image URL, or upload from{' '}
                    <Link
                      href="/coach/settings/profile"
                      className="text-[var(--cp-accent)] hover:underline underline-offset-2"
                    >
                      Settings &rsaquo; Profile
                    </Link>
                    .
                  </p>
                </div>

                {/* Live preview */}
                <div className="mb-5 overflow-hidden rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-muted)]">
                  <div className="flex h-12 items-center gap-2.5 border-b border-[var(--border-subtle)] bg-[var(--cp-offwhite,#F8F8F8)] px-4">
                    {logoUrl && !logoImgError ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl}
                        alt=""
                        className="size-7 rounded-[6px] object-contain border border-[var(--border-subtle)]"
                        onError={() => setLogoImgError(true)}
                      />
                    ) : (
                      <div
                        className="size-7 rounded-[6px] border border-[var(--border-default)]"
                        style={{ backgroundColor: accentColor + '22' }}
                      />
                    )}
                    <div>
                      <div className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight">
                        {workspaceDisplayName || 'Your Brand'}
                      </div>
                      {brandTagline && (
                        <div className="text-[10px] text-[var(--text-tertiary)] leading-tight">
                          {brandTagline}
                        </div>
                      )}
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <div className="h-5 w-16 rounded-full bg-[var(--bg-muted)]" />
                      <div className="size-7 rounded-full border border-[var(--border-default)] bg-[var(--bg-muted)]" />
                    </div>
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-[11px] text-[var(--text-quaternary)]">Client portal preview</p>
                  </div>
                </div>

                {/* Error */}
                {brandError && (
                  <div
                    role="alert"
                    className="mb-3 rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[13px] text-[#B91C1C]"
                  >
                    {brandError}
                  </div>
                )}

                {/* Save button */}
                <button
                  type="button"
                  onClick={() => void handleBrandSave()}
                  disabled={brandSaving}
                  style={{
                    height: 38,
                    padding: '0 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: brandSaved
                      ? '#15803D'
                      : brandSaving
                        ? 'var(--border-default)'
                        : 'var(--cp-accent)',
                    color: brandSaving && !brandSaved ? 'var(--text-tertiary)' : '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: brandSaving ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    minWidth: 120,
                    justifyContent: 'center',
                  }}
                >
                  {brandSaving ? (
                    <>
                      <div
                        style={{
                          width: 13,
                          height: 13,
                          border: '2px solid rgba(255,255,255,0.35)',
                          borderTopColor: '#fff',
                          borderRadius: '50%',
                          animation: 'cp-spin 0.7s linear infinite',
                        }}
                      />
                      Saving...
                    </>
                  ) : brandSaved ? (
                    '✓ Saved'
                  ) : (
                    'Save brand'
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ─── Section C: Accent Color ─── */}
        <div className="mb-6 overflow-hidden rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-subtle)]">
          <div className="border-b border-[var(--border-subtle)] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Accent Color</h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-tertiary)]">
              This color appears on buttons, active nav items, and highlights throughout your workspace and your clients&rsquo; portal.
            </p>
          </div>

          <div className="px-5 py-5">
            {accentLoading ? (
              <div className="flex h-20 items-center justify-center">
                <div
                  style={{
                    width: 20,
                    height: 20,
                    border: '2px solid var(--border-default)',
                    borderTopColor: 'var(--cp-accent)',
                    borderRadius: '50%',
                    animation: 'cp-spin 0.7s linear infinite',
                  }}
                />
              </div>
            ) : (
              <AccentColorPicker currentAccent={accentColor} onSave={handleAccentSave} />
            )}
          </div>
        </div>

      </div>

      <style>{`@keyframes cp-spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  )
}
