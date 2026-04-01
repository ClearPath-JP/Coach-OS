/**
 * Single hardcoded super-admin identity is enforced by ADMIN_EMAIL (server env).
 * No UI or API may grant admin; access checks use this email match.
 */
export function getAdminEmail(): string | undefined {
  const raw = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return raw || undefined
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const admin = getAdminEmail()
  if (!admin || !email) return false
  return email.trim().toLowerCase() === admin
}
