/**
 * Pure selection logic for spending a class-credit pass when a client books a class.
 * Extracted from the booking route so it can be unit-tested without a DB.
 *
 * Rules: a pass is usable if it has credits left, isn't expired, and covers the class type
 * ('all' covers everything; 'types' covers only listed session types). When several qualify,
 * spend FIFO — the oldest-expiring first (never-expiring passes last), tie-broken by the
 * oldest purchase — so credits that would expire soonest are used before they're lost.
 */
export type UsablePassCandidate = {
  id: string
  credits_remaining: number
  expires_at: string | null
  purchased_at: string
  applies_to: string
  applies_to_types: string[] | null
}

export function selectUsablePass(
  passes: UsablePassCandidate[],
  classType: string | null,
  nowMs: number
): UsablePassCandidate | null {
  const usable = passes
    .filter((p) => p.credits_remaining > 0)
    .filter((p) => !p.expires_at || new Date(p.expires_at).getTime() > nowMs)
    .filter((p) =>
      p.applies_to === 'types' ? (p.applies_to_types ?? []).includes(classType ?? '') : true
    )
    .sort((a, b) => {
      const ax = a.expires_at ? new Date(a.expires_at).getTime() : Infinity
      const bx = b.expires_at ? new Date(b.expires_at).getTime() : Infinity
      if (ax !== bx) return ax - bx
      return new Date(a.purchased_at).getTime() - new Date(b.purchased_at).getTime()
    })
  return usable[0] ?? null
}
