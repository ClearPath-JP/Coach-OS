/**
 * Phase 4 coach accent — whitelist only (security + brand-safe).
 * Stored in `workspaces.accent_color` (existing column).
 * Includes both legacy presets and stance-derived accent colors.
 */

export const PHASE4_DEFAULT_COACH_ACCENT = '#9F1239' as const

export const ALLOWED_COACH_ACCENT_HEXES = [
  // Combat Light default
  '#9F1239', // Burgundy Rose
  // Legacy presets
  '#1D4ED8', // Sapphire
  '#4F46E5', // Royal
  '#0369A1', // Ocean
  '#0F766E', // Teal
  '#15803D', // Forest
  '#7C3AED', // Violet
  '#BE185D', // Rose
  '#B45309', // Amber
  // Stance accent colors (GoT)
  '#C4A44A', // Golden Fields (Izuhara)
  '#5A8A4A', // Jade Forest (Toyotama)
  '#6A8AA4', // Winter Steel (Kamiagata)
  '#8B3A3A', // Blood Oath (Crimson)
  '#8A7A5A', // Ronin
] as const

export type AccentColor = (typeof ALLOWED_COACH_ACCENT_HEXES)[number]

const NORMALIZED_ALLOWED = new Set(
  ALLOWED_COACH_ACCENT_HEXES.map((h) => h.replace('#', '').toUpperCase())
)

export function normalizeHex6ForCompare(hex: string): string {
  const s = hex.trim()
  const without = s.startsWith('#') ? s.slice(1) : s
  if (!/^[0-9A-Fa-f]{6}$/.test(without)) return ''
  return without.toUpperCase()
}

export function isAllowedCoachAccentHex(hex: string | null | undefined): hex is AccentColor {
  if (!hex?.trim()) return false
  return NORMALIZED_ALLOWED.has(normalizeHex6ForCompare(hex))
}

/** Canonical `#RRGGBB` from whitelist, or default sapphire. */
export function coerceToAllowedCoachAccent(stored: string | null | undefined): AccentColor {
  if (stored && isAllowedCoachAccentHex(stored)) {
    const n = normalizeHex6ForCompare(stored)
    return (`#${n}` as AccentColor)
  }
  return PHASE4_DEFAULT_COACH_ACCENT
}

export function coachAccentStyleTagContent(accentHex: AccentColor): string {
  return `:root { --cp-accent: ${accentHex}; }`
}
