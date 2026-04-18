/** Preset color palette for video categories. */

export type CategoryColorKey =
  | 'red'
  | 'orange'
  | 'amber'
  | 'green'
  | 'teal'
  | 'blue'
  | 'purple'
  | 'pink'

export type CategoryColor = {
  key: CategoryColorKey
  label: string
  /** Badge background (light tint) */
  bg: string
  /** Badge text / dot color */
  text: string
  /** Dot/swatch color for picker */
  dot: string
}

export const CATEGORY_COLORS: CategoryColor[] = [
  { key: 'red', label: 'Red', bg: 'bg-red-100', text: 'text-red-700', dot: '#ef4444' },
  { key: 'orange', label: 'Orange', bg: 'bg-orange-100', text: 'text-orange-700', dot: '#f97316' },
  { key: 'amber', label: 'Amber', bg: 'bg-amber-100', text: 'text-amber-700', dot: '#f59e0b' },
  { key: 'green', label: 'Green', bg: 'bg-green-100', text: 'text-green-700', dot: '#22c55e' },
  { key: 'teal', label: 'Teal', bg: 'bg-teal-100', text: 'text-teal-700', dot: '#14b8a6' },
  { key: 'blue', label: 'Blue', bg: 'bg-blue-100', text: 'text-blue-700', dot: '#3b82f6' },
  { key: 'purple', label: 'Purple', bg: 'bg-purple-100', text: 'text-purple-700', dot: '#a855f7' },
  { key: 'pink', label: 'Pink', bg: 'bg-pink-100', text: 'text-pink-700', dot: '#ec4899' },
]

export const CATEGORY_COLOR_MAP = Object.fromEntries(
  CATEGORY_COLORS.map((c) => [c.key, c])
) as Record<CategoryColorKey, CategoryColor>

export function getCategoryColor(key: string | null | undefined): CategoryColor {
  if (key && key in CATEGORY_COLOR_MAP) return CATEGORY_COLOR_MAP[key as CategoryColorKey]!
  return CATEGORY_COLORS[5]! // default blue
}

/** Auto-assign colors round-robin for migration */
export function autoAssignColor(index: number): CategoryColorKey {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length]!.key
}
