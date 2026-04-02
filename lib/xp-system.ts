import { differenceInCalendarDays, startOfDay } from 'date-fns'

export const XP_ACTIONS = {
  ASSIGNMENT_SUBMITTED: 5,
  ASSIGNMENT_APPROVED: 10,
  STREAK_BONUS: 5,
  DAILY_CHECKIN: 5,
  PROGRAM_MODULE_COMPLETE: 15,
  SESSION_ATTENDED: 20,
  PROGRAM_COMPLETE: 50,
  GOAL_ACHIEVED: 100,
} as const

export const LEVELS = [
  { level: 1, name: 'Beginner', minXp: 0, maxXp: 99 },
  { level: 2, name: 'Rising', minXp: 100, maxXp: 249 },
  { level: 3, name: 'Committed', minXp: 250, maxXp: 499 },
  { level: 4, name: 'Dedicated', minXp: 500, maxXp: 999 },
  { level: 5, name: 'Elite', minXp: 1000, maxXp: 9999 },
] as const

export type LevelDef = (typeof LEVELS)[number]

export function getLevelFromXp(xp: number): LevelDef {
  let current: LevelDef = LEVELS[0]!
  for (const l of LEVELS) {
    if (xp >= l.minXp) current = l
  }
  return current
}

export function getXpToNextLevel(xp: number): number {
  const current = getLevelFromXp(xp)
  const next = LEVELS.find((l) => l.level === current.level + 1)
  if (!next) return 0
  return Math.max(0, next.minXp - xp)
}

export function getProgressPercent(xp: number): number {
  const current = getLevelFromXp(xp)
  const next = LEVELS.find((l) => l.level === current.level + 1)
  if (!next) return 100
  const range = next.minXp - current.minXp
  if (range <= 0) return 100
  const progress = xp - current.minXp
  return Math.min(100, Math.max(0, Math.round((progress / range) * 100)))
}

export function levelNumberFromXp(xp: number): number {
  return getLevelFromXp(xp).level
}

/** Update streak when client earns activity (e.g. approval). Returns new streak fields + whether streak bonus applies. */
export function computeStreakUpdate(
  prevStreak: number,
  longestStreak: number,
  lastActivityAt: string | null,
  at: Date = new Date()
): { currentStreakDays: number; longestStreakDays: number; streakBonus: boolean } {
  if (!lastActivityAt) {
    const s = 1
    return {
      currentStreakDays: s,
      longestStreakDays: Math.max(longestStreak, s),
      streakBonus: false,
    }
  }
  const last = startOfDay(new Date(lastActivityAt))
  const today = startOfDay(at)
  const diff = differenceInCalendarDays(today, last)
  if (diff === 0) {
    return { currentStreakDays: prevStreak, longestStreakDays: longestStreak, streakBonus: false }
  }
  if (diff === 1) {
    const s = prevStreak + 1
    return {
      currentStreakDays: s,
      longestStreakDays: Math.max(longestStreak, s),
      streakBonus: prevStreak >= 1,
    }
  }
  return {
    currentStreakDays: 1,
    longestStreakDays: Math.max(longestStreak, 1),
    streakBonus: false,
  }
}
