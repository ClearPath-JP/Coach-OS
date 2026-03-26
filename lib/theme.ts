export type Theme = 'light' | 'dark'

export const THEMES: readonly Theme[] = ['light', 'dark'] as const

export const THEME_STORAGE_KEY = 'clearpath-theme'
