import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Lowercase + trim for comparing auth email to clients.email / profiles.email. */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

/**
 * Sanitize user text for PostgREST .or() / .ilike() patterns: escape % _ \\,
 * strip quotes, trim, cap length.
 */
export function sanitizeIlikeSearch(raw: string): string {
  return raw
    .replace(/[%_\\]/g, '\\$&')
    .replace(/['"]/g, '')
    .trim()
    .slice(0, 100)
}

/** Merge rows by `id`, then sort by `created_at` ascending (message threads / pagination overlap). */
export function mergeByIdSortByCreatedAt<T extends { id: string; created_at: string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const byId = new Map<string, T>()
  for (const m of existing) byId.set(m.id, m)
  for (const m of incoming) byId.set(m.id, m)
  return [...byId.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
}
