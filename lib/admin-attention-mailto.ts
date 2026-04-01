import { getAdminAppOrigin } from '@/lib/admin-app-origin'

/** Prefilled mailto links for “close the loop” from admin attention items. */

export function mailtoPastDueBilling(params: { coachEmail: string; workspaceName: string }): string {
  const { coachEmail, workspaceName } = params
  if (!coachEmail.trim()) return 'mailto:'
  const billingUrl = `${getAdminAppOrigin()}/billing`
  const subject = `ClearPath — subscription update for ${workspaceName}`
  const body = `Hi,

We’re reaching out from ClearPath support. Your workspace “${workspaceName}” shows a past-due subscription. If you’re already working on this, you can ignore this message.

Please sign in and update billing, or reply if you need help: ${billingUrl}

Thanks,
ClearPath Support`
  return `mailto:${encodeURIComponent(coachEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function mailtoInactiveCoachCheckIn(params: {
  coachEmail: string
  workspaceName: string
  daysInactive: number
}): string {
  const { coachEmail, workspaceName, daysInactive } = params
  if (!coachEmail.trim()) return 'mailto:'
  const subject = `Quick check-in — ${workspaceName} on ClearPath`
  const body = `Hi,

Hope you’re doing well. We noticed no activity on your ClearPath workspace “${workspaceName}” for about ${daysInactive} days and wanted to check in. If everything’s fine, no need to reply.

If you hit any snags or want a quick refresher, just reply to this email.

Thanks,
ClearPath Support`
  return `mailto:${encodeURIComponent(coachEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
