import { createServiceClient } from '@/lib/supabase/service'
import { resolveAppBaseUrl } from '@/lib/app-base-url'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function coachEmailAndActivityEnabled(coachUserId: string): Promise<{
  email: string
  enabled: boolean
}> {
  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('email, notification_client_activity')
    .eq('id', coachUserId)
    .maybeSingle()
  const email = (profile?.email ?? '').trim()
  const enabled = profile?.notification_client_activity !== false
  return { email, enabled }
}

export async function notifyCoachGoalAchieved(params: {
  coachUserId: string
  clientName: string
  goalTitle: string
  clientId: string
  request: Request
}): Promise<void> {
  const { email, enabled } = await coachEmailAndActivityEnabled(params.coachUserId)
  if (!enabled || !email) return

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const base = resolveAppBaseUrl(params.request)
  const name = escapeHtml(params.clientName.trim() || 'Client')
  const title = escapeHtml(params.goalTitle.trim() || 'Goal')
  const link = `${base}/coach/clients/${encodeURIComponent(params.clientId)}`
  const from = process.env.EMAIL_FROM_DEFAULT?.trim() || 'ClearPath <onboarding@resend.dev>'

  const html = `
    <h2>Goal achieved</h2>
    <p>${name} reached: <strong>${title}</strong></p>
    <p><a href="${link}">Open client profile →</a></p>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${params.clientName.trim() || 'Client'} achieved a goal`,
      html,
    }),
  })
  if (!res.ok && process.env.NODE_ENV === 'production') {
    const text = await res.text().catch(() => '')
    console.error('notifyCoachGoalAchieved resend failed', res.status, text)
  }
}

export async function notifyCoachClientQuiet(params: {
  coachUserId: string
  clientName: string
  clientId: string
  request: Request
}): Promise<void> {
  const { email, enabled } = await coachEmailAndActivityEnabled(params.coachUserId)
  if (!enabled || !email) return

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const base = resolveAppBaseUrl(params.request)
  const name = escapeHtml(params.clientName.trim() || 'Client')
  const link = `${base}/coach/messages?clientId=${encodeURIComponent(params.clientId)}`
  const from = process.env.EMAIL_FROM_DEFAULT?.trim() || 'ClearPath <onboarding@resend.dev>'

  const html = `
    <h2>Client may need a nudge</h2>
    <p>${name} hasn&apos;t engaged in over a week (no recent messages or activity).</p>
    <p><a href="${link}">Send a message →</a></p>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `Check in with ${params.clientName.trim() || 'a client'}`,
      html,
    }),
  })
  if (!res.ok && process.env.NODE_ENV === 'production') {
    const text = await res.text().catch(() => '')
    console.error('notifyCoachClientQuiet resend failed', res.status, text)
  }
}
