/** Shared accent helpers for workspace branding (light tints for DB + CSS vars). */

import { DEFAULT_COACH_ACCENT, findCoachThemeByAccent } from '@/lib/coach-themes'

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

/** Pastel tint for light surfaces (stored in DB as accent_color_light). */
export function getAccentLight(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  const mix = (channel: number) => channel * 0.15 + 255 * 0.85
  return rgbToHex(mix(r), mix(g), mix(b))
}

/** Muted border tint */
export function getAccentMuted(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  const mix = (channel: number) => channel * 0.25 + 255 * 0.75
  return rgbToHex(mix(r), mix(g), mix(b))
}

/** Darken a hex color by ratio 0–1 (default ~12%). */
export function darkenHex(hex: string, ratio = 0.12): string {
  const [r, g, b] = hexToRgb(hex)
  const d = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 - ratio))))
  return rgbToHex(d(r), d(g), d(b))
}

/** Hover accent for injected CSS: use preset when hex matches a theme, else darken. */
export function resolveAccentHover(accentHex: string): string {
  const preset = findCoachThemeByAccent(accentHex)
  if (preset) return preset.hover
  try {
    return darkenHex(accentHex, 0.12)
  } catch {
    return darkenHex(DEFAULT_COACH_ACCENT, 0.12)
  }
}

export function resolveAccentFamily(accentHex: string, accentLightHex: string) {
  const preset = findCoachThemeByAccent(accentHex)
  if (preset) {
    return {
      accent: preset.accent,
      accentDark: preset.accentDark,
      hover: preset.hover,
      light: accentLightHex || preset.light,
      muted: preset.muted,
    }
  }
  try {
    return {
      accent: accentHex,
      accentDark: darkenHex(accentHex, 0.15),
      hover: resolveAccentHover(accentHex),
      light: accentLightHex || getAccentLight(accentHex),
      muted: getAccentMuted(accentHex),
    }
  } catch {
    return resolveAccentFamily(DEFAULT_COACH_ACCENT, getAccentLight(DEFAULT_COACH_ACCENT))
  }
}

/**
 * Applies accent on the document. In dark mode, omit inline `--accent-light` so
 * `html[data-theme='dark']` theme tokens apply.
 */
export function applyWorkspaceAccentVars(accentHex: string, accentLightHex: string): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const { accent, accentDark, hover, light, muted } = resolveAccentFamily(accentHex, accentLightHex)
  root.style.setProperty('--accent', accent)
  root.style.setProperty('--accent-dark', accentDark)
  root.style.setProperty('--accent-hover', hover)
  root.style.setProperty('--accent-muted', muted)
  root.style.setProperty('--color-accent', accent)
  root.style.setProperty('--color-accent-hover', hover)
  if (root.getAttribute('data-theme') === 'dark') {
    root.style.removeProperty('--accent-light')
    root.style.removeProperty('--color-accent-light')
  } else {
    root.style.setProperty('--accent-light', light)
    root.style.setProperty('--color-accent-light', light)
  }
}
