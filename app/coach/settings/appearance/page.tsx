'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AccentColorPicker } from '@/components/settings/AccentColorPicker'
import type { AccentColor } from '@/types/coach'
import { coerceToAllowedCoachAccent, PHASE4_DEFAULT_COACH_ACCENT } from '@/lib/coach-accent-phase4'
import { applyWorkspaceAccentVars, getAccentLight } from '@/lib/accent-colors'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '@/lib/workspace-context'

export default function CoachAppearancePage() {
  const router = useRouter()
  const { updateSettings, refetchSettings } = useWorkspace()
  const [accentColor, setAccentColor] = useState<AccentColor>(PHASE4_DEFAULT_COACH_ACCENT)
  const [loading, setLoading] = useState(true)

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
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async (hex: AccentColor) => {
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

  return (
    <main className="flex min-h-0 min-h-screen flex-1 flex-col">
      <div style={{ maxWidth: 560, padding: '32px 24px' }}>
        <p className="mb-4 text-[13px]">
          <Link href="/coach/settings" className="text-[var(--cp-accent)] underline-offset-2 hover:underline">
            ← Back to settings
          </Link>
        </p>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--cp-navy)',
            marginBottom: 6,
          }}
        >
          Appearance
        </h1>
        <p
          style={{
            fontSize: 14,
            color: 'var(--cp-gray)',
            marginBottom: 32,
            lineHeight: 1.5,
          }}
        >
          Customize how your workspace looks. Changes are visible to you and your students.
        </p>

        <div
          style={{
            background: 'var(--cp-white)',
            border: '1px solid var(--cp-border)',
            borderRadius: 12,
            padding: '24px',
          }}
        >
          {loading ? (
            <div
              style={{
                height: 80,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  border: '2px solid var(--cp-border)',
                  borderTopColor: 'var(--cp-sapphire)',
                  borderRadius: '50%',
                  animation: 'cp-spin 0.7s linear infinite',
                }}
              />
            </div>
          ) : (
            <AccentColorPicker currentAccent={accentColor} onSave={handleSave} />
          )}
        </div>

        <style>{`@keyframes cp-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </main>
  )
}
