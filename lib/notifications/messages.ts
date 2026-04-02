import { createServiceClient } from '@/lib/supabase/service'
import { resolveAppBaseUrl } from '@/lib/app-base-url'
import { tryAcquireNotifyDedupeKey } from '@/lib/redis-notify-dedupe'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Email the coach when a client sends a message (respects profile notification toggle + dedupe).
 * Uses service client so the sender (client) does not need RLS access to the coach profile row.
 */
export async function notifyCoachOfMessage(
  coachUserId: string,
  coachEmail: string,
  clientName: string,
  clientId: string,
  messageContent: string,
  _workspaceId: string,
  request: Request
): Promise<void> {
  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('email, notification_new_message')
    .eq('id', coachUserId)
    .maybeSingle()

  if (profile?.notification_new_message === false) return

  const toEmail = (coachEmail || profile?.email || '').trim()
  if (!toEmail) return

  const acquired = await tryAcquireNotifyDedupeKey(`msg-notify:${coachUserId}:${clientId}`, 1800)
  if (!acquired) return

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const base = resolveAppBaseUrl(request)
  const preview = escapeHtml((messageContent ?? '').slice(0, 200))
  const name = escapeHtml(clientName.trim() || 'Your client')
  const messagesUrl = `${base}/coach/messages?clientId=${encodeURIComponent(clientId)}`
  const settingsUrl = `${base}/coach/settings?tab=notifications`

  const from =
    process.env.EMAIL_FROM_DEFAULT?.trim() || 'ClearPath <onboarding@resend.dev>'

  const html = `
    <h2>New message from ${name}</h2>
    <p>${preview || '<em>(no text)</em>'}</p>
    <p><a href="${messagesUrl}">Reply to ${name} →</a></p>
    <p style="color:#888;font-size:12px">
      You're receiving this because you have message notifications enabled.
      <a href="${settingsUrl}">Manage notifications</a>
    </p>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [toEmail],
      subject: `New message from ${clientName.trim() || 'a client'}`,
      html,
    }),
  })

  if (!res.ok && process.env.NODE_ENV === 'production') {
    const text = await res.text().catch(() => '')
    console.error('notifyCoachOfMessage resend failed', res.status, text)
  }
}
