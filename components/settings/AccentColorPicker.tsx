'use client'

import { useEffect, useState } from 'react'
import type { AccentColor } from '@/types/coach'

const ACCENT_OPTIONS: { hex: AccentColor; label: string }[] = [
  { hex: `#${'1D4ED8'}` as AccentColor, label: 'Sapphire' },
  { hex: `#${'4F46E5'}` as AccentColor, label: 'Royal' },
  { hex: '#0369A1', label: 'Ocean' },
  { hex: '#0F766E', label: 'Teal' },
  { hex: '#15803D', label: 'Forest' },
  { hex: '#7C3AED', label: 'Violet' },
  { hex: '#BE185D', label: 'Rose' },
  { hex: '#B45309', label: 'Amber' },
]

export interface AccentColorPickerProps {
  currentAccent: AccentColor
  onSave: (hex: AccentColor) => Promise<void>
}

export function AccentColorPicker({ currentAccent, onSave }: AccentColorPickerProps) {
  const [selected, setSelected] = useState<AccentColor>(currentAccent)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSelected(currentAccent)
  }, [currentAccent])

  const hasChanged = selected !== currentAccent

  const handleSelect = (hex: AccentColor) => {
    setSelected(hex)
    setSaved(false)
    setError(null)
    document.documentElement.style.setProperty('--cp-accent', hex)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(selected)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Could not save. Please try again.')
      document.documentElement.style.setProperty('--cp-accent', currentAccent)
      setSelected(currentAccent)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--cp-navy)',
            marginBottom: 4,
          }}
        >
          Accent color
        </h3>
        <p style={{ fontSize: 13, color: 'var(--cp-gray)', lineHeight: 1.5 }}>
          Personalizes your workspace. Students see this color when they log into your portal.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        {ACCENT_OPTIONS.map(({ hex, label }) => {
          const isSelected = selected === hex
          return (
            <button
              key={hex}
              type="button"
              aria-label={`${label} accent color${isSelected ? ' (selected)' : ''}`}
              onClick={() => handleSelect(hex)}
              title={label}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: hex,
                border: isSelected ? `3px solid var(--cp-navy)` : '3px solid transparent',
                outline: isSelected ? `2px solid ${hex}` : '2px solid transparent',
                outlineOffset: 1,
                cursor: 'pointer',
                transition: 'transform 0.12s, outline 0.12s, border 0.12s',
                transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                padding: 0,
              }}
              onMouseEnter={(e) => {
                if (!isSelected)
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'
              }}
              onMouseLeave={(e) => {
                if (!isSelected) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
              }}
            />
          )
        })}
      </div>

      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          disabled
          style={{ background: selected, color: 'white' }}
          className="rounded-[8px] px-4 py-2 text-[13px] font-semibold opacity-100 cursor-default"
        >
          Button preview
        </button>
        <div
          className="rounded-[6px] px-3 py-1.5 text-[13px] font-medium"
          style={{ background: selected + '22', color: selected }}
        >
          Active state
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: selected,
            border: '1px solid rgba(0,0,0,0.1)',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 13, color: 'var(--cp-gray)' }}>
          {ACCENT_OPTIONS.find((o) => o.hex === selected)?.label}{' '}
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{selected}</span>
        </span>
      </div>

      {error ? (
        <div
          role="alert"
          style={{
            fontSize: 13,
            color: '#B91C1C',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 8,
            padding: '8px 12px',
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={!hasChanged || saving}
        style={{
          height: 38,
          padding: '0 20px',
          borderRadius: 8,
          border: 'none',
          background: saved ? '#15803D' : !hasChanged || saving ? 'var(--cp-border)' : 'var(--cp-accent)',
          color: (!hasChanged || saving) && !saved ? 'var(--cp-gray)' : '#FFFFFF',
          fontSize: 13,
          fontWeight: 600,
          cursor: !hasChanged || saving ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 100,
          justifyContent: 'center',
        }}
      >
        {saving ? (
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
        ) : saved ? (
          '✓ Saved'
        ) : (
          'Save accent'
        )}
      </button>
    </div>
  )
}
