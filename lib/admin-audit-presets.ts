export type AuditFilterPreset = {
  name: string
  category: string
  q: string
  workspaceId: string
  from: string
  to: string
  rangePreset: 'today' | '7' | '30' | 'custom'
}

const STORAGE_KEY = 'clearpath-admin-audit-presets-v1'
const MAX_PRESETS = 12

export function loadAuditPresets(): AuditFilterPreset[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (p): p is AuditFilterPreset =>
        p != null &&
        typeof p === 'object' &&
        typeof (p as AuditFilterPreset).name === 'string' &&
        typeof (p as AuditFilterPreset).category === 'string'
    )
  } catch {
    return []
  }
}

export function saveAuditPresets(presets: AuditFilterPreset[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets.slice(0, MAX_PRESETS)))
  } catch {
    // ignore quota
  }
}

export function addAuditPreset(preset: AuditFilterPreset): AuditFilterPreset[] {
  const existing = loadAuditPresets().filter((p) => p.name.trim().toLowerCase() !== preset.name.trim().toLowerCase())
  const next = [preset, ...existing].slice(0, MAX_PRESETS)
  saveAuditPresets(next)
  return next
}

export function removeAuditPreset(name: string): AuditFilterPreset[] {
  const next = loadAuditPresets().filter((p) => p.name !== name)
  saveAuditPresets(next)
  return next
}
