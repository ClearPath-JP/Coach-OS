/**
 * Stance themes — Ghost of Tsushima region-inspired visual themes.
 * Each stance controls accent color, sidebar warmth, card tint, and section label color.
 * Stored in `workspaces.stance_id`.
 */

export interface StanceTheme {
  id: string
  label: string
  region: string
  description: string
  accent: string
  accentHover: string
  accentLight: string
  accentMuted: string
  cardTint: string
  sidebarBg: string
  sidebarBorder: string
  sidebarHover: string
  sectionLabelColor: string
  /** text-on-accent color (for buttons, badges on accent bg) */
  textOnAccent: string
}

export const STANCES: readonly StanceTheme[] = [
  {
    id: 'izuhara',
    label: 'Golden Fields',
    region: 'Izuhara',
    description: 'Warm gold and amber — the default stance',
    accent: '#C4A44A',
    accentHover: '#D4B45A',
    accentLight: '#1E1A10',
    accentMuted: '#2A2414',
    cardTint: 'rgba(196, 164, 74, 0.04)',
    sidebarBg: '#0D0B08',
    sidebarBorder: '#1A1612',
    sidebarHover: 'rgba(196, 164, 74, 0.06)',
    sectionLabelColor: '#A08838',
    textOnAccent: '#0F0D0B',
  },
  {
    id: 'toyotama',
    label: 'Jade Forest',
    region: 'Toyotama',
    description: 'Lush green and bamboo — growth and vitality',
    accent: '#5A8A4A',
    accentHover: '#6A9A5A',
    accentLight: '#101A0C',
    accentMuted: '#1A2E14',
    cardTint: 'rgba(90, 138, 74, 0.04)',
    sidebarBg: '#080D06',
    sidebarBorder: '#121A0E',
    sidebarHover: 'rgba(90, 138, 74, 0.06)',
    sectionLabelColor: '#5A8A4A',
    textOnAccent: '#F0EDE8',
  },
  {
    id: 'kamiagata',
    label: 'Winter Steel',
    region: 'Kamiagata',
    description: 'Cool steel and frost — clarity and focus',
    accent: '#6A8AA4',
    accentHover: '#7A9AB4',
    accentLight: '#0E1418',
    accentMuted: '#142028',
    cardTint: 'rgba(106, 138, 164, 0.04)',
    sidebarBg: '#080A0D',
    sidebarBorder: '#0E1218',
    sidebarHover: 'rgba(106, 138, 164, 0.06)',
    sectionLabelColor: '#6A8AA4',
    textOnAccent: '#0F0D0B',
  },
  {
    id: 'crimson',
    label: 'Blood Oath',
    region: 'Iki Island',
    description: 'Deep crimson and charcoal — intensity and discipline',
    accent: '#8B3A3A',
    accentHover: '#9B4A4A',
    accentLight: '#1A0D0A',
    accentMuted: '#2A1414',
    cardTint: 'rgba(139, 58, 58, 0.04)',
    sidebarBg: '#0D0808',
    sidebarBorder: '#1A1212',
    sidebarHover: 'rgba(139, 58, 58, 0.06)',
    sectionLabelColor: '#8B5A5A',
    textOnAccent: '#F0EDE8',
  },
  {
    id: 'ronin',
    label: 'Ronin',
    region: 'The Wanderer',
    description: 'Warm slate and amber — versatile and balanced',
    accent: '#8A7A5A',
    accentHover: '#9A8A6A',
    accentLight: '#141210',
    accentMuted: '#1E1A12',
    cardTint: 'rgba(138, 122, 90, 0.04)',
    sidebarBg: '#0A0908',
    sidebarBorder: '#161410',
    sidebarHover: 'rgba(138, 122, 90, 0.06)',
    sectionLabelColor: '#8A7A5A',
    textOnAccent: '#0F0D0B',
  },
] as const

export type StanceId = (typeof STANCES)[number]['id']
export const DEFAULT_STANCE_ID: StanceId = 'izuhara'

export function findStance(id: string | null | undefined): StanceTheme {
  return STANCES.find((s) => s.id === id) ?? STANCES[0]!
}

/** All stance accent hex values for whitelist validation. */
export const STANCE_ACCENT_HEXES = STANCES.map((s) => s.accent)
