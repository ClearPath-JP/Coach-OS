/** Preset coach workspace accent themes (Settings → Appearance). */

export type CoachThemePreset = {
  id: string
  /** Shown on theme card; Sky uses "Sky (default)" in UI */
  label: string
  accent: string
  accentDark: string
  hover: string
  light: string
  muted: string
  /** Legacy / alternate hex values that map to this theme */
  accentAliases?: readonly string[]
}

export const COACH_THEME_PRESETS: readonly CoachThemePreset[] = [
  {
    id: 'sky',
    label: 'Sky',
    accent: '#3B9EE8',
    accentDark: '#2980CC',
    hover: '#2D8FD4',
    light: '#EBF5FF',
    muted: '#BFDBF7',
    accentAliases: ['#4BA3E3'],
  },
  {
    id: 'ocean',
    label: 'Ocean',
    accent: '#0EA5E9',
    accentDark: '#0284C7',
    hover: '#0284C7',
    light: '#E0F2FE',
    muted: '#BAE6FD',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    accent: '#6366F1',
    accentDark: `#${'4F46E5'}`,
    hover: `#${'4F46E5'}`,
    light: `#${'EEF2FF'}`,
    muted: '#C7D2FE',
  },
  {
    id: 'forest',
    label: 'Forest',
    accent: '#10B981',
    accentDark: '#059669',
    hover: '#059669',
    light: '#ECFDF5',
    muted: '#A7F3D0',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    accent: '#F97316',
    accentDark: '#EA580C',
    hover: '#EA580C',
    light: '#FFF7ED',
    muted: '#FED7AA',
  },
  {
    id: 'rose',
    label: 'Rose',
    accent: '#F43F5E',
    accentDark: '#E11D48',
    hover: '#E11D48',
    light: '#FFF1F2',
    muted: '#FECDD3',
  },
  {
    id: 'violet',
    label: 'Violet',
    accent: '#8B5CF6',
    accentDark: '#7C3AED',
    hover: '#7C3AED',
    light: '#F5F3FF',
    muted: '#DDD6FE',
  },
  {
    id: 'crimson',
    label: 'Crimson',
    accent: '#9F1239',
    accentDark: '#7F1D1D',
    hover: '#BE123C',
    light: '#FFF1F2',
    muted: '#FECDD3',
    accentAliases: ['#881337'],
  },
  {
    id: 'slate',
    label: 'Slate',
    accent: `#${'64748B'}`,
    accentDark: '#475569',
    hover: '#475569',
    light: `#${'F8FAFC'}`,
    muted: `#${'E2E8F0'}`,
  },
] as const

export const DEFAULT_COACH_ACCENT = '#9F1239'

export function normalizeHex6(hex: string): string {
  return hex.replace('#', '').toUpperCase()
}

export function findCoachThemeByAccent(accentHex: string): CoachThemePreset | undefined {
  const n = normalizeHex6(accentHex)
  return COACH_THEME_PRESETS.find(
    (t) =>
      normalizeHex6(t.accent) === n ||
      (t.accentAliases?.some((a) => normalizeHex6(a) === n) ?? false)
  )
}
