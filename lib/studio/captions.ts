import type { Caption } from '@/lib/bunny' // { startMs, endMs, text } — TYPE-ONLY import (erased at runtime)

// Shift a source clip's cues onto the timeline: subtract the clip's trim-in,
// keep only cues that fall inside the trimmed window, then add the clip's
// timeline start offset. Returns cues in timeline-time (ms).
export function offsetCues(
  cues: Caption[],
  clip: { inSec: number; outSec: number; startSec: number },
): Caption[] {
  const inMs = clip.inSec * 1000
  const outMs = clip.outSec * 1000
  const startMs = clip.startSec * 1000
  const out: Caption[] = []
  for (const c of cues) {
    if (c.endMs <= inMs || c.startMs >= outMs) continue // outside trim window
    const s = Math.max(c.startMs, inMs) - inMs + startMs
    const e = Math.min(c.endMs, outMs) - inMs + startMs
    out.push({ startMs: Math.round(s), endMs: Math.round(e), text: c.text })
  }
  return out
}
