export function calculateEngagementScore(client: {
  last_activity_at: string | null
  assignments_completed: number
  assignments_total: number
  streak_days: number
}): {
  score: number
  label: 'engaged' | 'moderate' | 'at-risk'
  color: string
} {
  let score = 5

  const daysSince = client.last_activity_at
    ? Math.floor((Date.now() - new Date(client.last_activity_at).getTime()) / 86400000)
    : 30

  if (daysSince <= 1) score += 2
  else if (daysSince <= 3) score += 1
  else if (daysSince >= 14) score -= 3
  else if (daysSince >= 7) score -= 2

  const rate =
    client.assignments_total > 0 ? client.assignments_completed / client.assignments_total : 0.5

  if (rate >= 0.8) score += 2
  else if (rate >= 0.5) score += 1
  else if (rate < 0.3) score -= 2

  if (client.streak_days >= 7) score += 1

  score = Math.max(1, Math.min(10, score))

  const label = score >= 7 ? 'engaged' : score >= 4 ? 'moderate' : 'at-risk'

  const color = score >= 7 ? 'var(--success)' : score >= 4 ? 'var(--warning)' : 'var(--error)'

  return { score, label, color }
}

export function engagementLabelText(label: 'engaged' | 'moderate' | 'at-risk'): string {
  if (label === 'engaged') return 'Engaged'
  if (label === 'moderate') return 'Moderate'
  return 'At risk'
}
