import type { CSSProperties } from 'react'
import type { Crop } from './timeline'

// Maps a normalized source crop rect to a CSS style that fills the 9:16 frame.
// null → plain center cover (fixes the legacy letterbox for landscape sources).
export function coverStyle(crop: Crop | null): CSSProperties {
  if (!crop) return { width: '100%', height: '100%', objectFit: 'cover' }
  const scale = 1 / Math.max(crop.w || 1, 0.0001)
  const txPct = (0.5 - (crop.x + crop.w / 2)) * 100 * scale
  const tyPct = (0.5 - (crop.y + crop.h / 2)) * 100 * scale
  return {
    width: '100%', height: '100%', objectFit: 'cover',
    transform: `scale(${scale.toFixed(4)}) translate(${txPct.toFixed(2)}%, ${tyPct.toFixed(2)}%)`,
    transformOrigin: 'center',
  }
}
