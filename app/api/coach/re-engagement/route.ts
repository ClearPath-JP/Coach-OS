import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { insertCoachThreadMessageAsCoach } from '@/lib/messages/insert-thread-message'
import { notifyCoachClientQuiet } from '@/lib/notifications/coach-activity-email'
import { formatAutoCheckinMessage } from '@/lib/re-engagement-default-message'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { tryAcquireNotifyDedupeKey } from '@/lib/redis-notify-dedupe'
import { resolveCoachUserIdForClientRow } from '@/lib/resolve-coach-user-for-client'
import { createServiceClient } from '@/lib/supabase/service'

const MS_DAY = 24 * 60 * 60 * 1000

type InactiveRow = {
  client_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  coach_id: string | null
  last_engagement_at: string
}

/**
 * POST /api/coach/re-engagement — scan workspace for quiet clients; email coach; optional auto check-in; 30-day testimonial prompt.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`coach-reengagement:${user.id}`, {
      windowMs: 60_000,
      max: 10,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * MS_DAY).toISOString()
    const fourteenDaysAgo = new Date(now.getTime() - 14 * MS_DAY).toISOString()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * MS_DAY).toISOString()

    const [{ data: ws }, inactiveRes] = await Promise.all([
      supabase
        .from('workspaces')
        .select('auto_checkin_enabled, auto_checkin_message')
        .eq('id', workspaceId)
        .maybeSingle(),
      supabase.rpc('get_coach_reengagement_inactive_clients', {
        p_workspace_id: workspaceId,
        p_coach_user_id: user.id,
        p_before: sevenDaysAgo,
        p_limit: 500,
      }),
    ])

    const inactive = (inactiveRes.data ?? []) as InactiveRow[]
    let coachEmailsSent = 0
    let autoMessagesSent = 0
    let testimonialPromptsSent = 0

    for (const row of inactive) {
      const name =
        [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'Client'
      const coachForClient =
        (await resolveCoachUserIdForClientRow({
          workspace_id: workspaceId,
          coach_id: row.coach_id,
        })) ?? user.id
      const weekKey = `${workspaceId}:${row.client_id}:${Math.floor(now.getTime() / (7 * MS_DAY))}`
      const acquiredEmail = await tryAcquireNotifyDedupeKey(`reengage-coach:${weekKey}`, 8 * 24 * 60 * 60)
      if (acquiredEmail) {
        await notifyCoachClientQuiet({
          coachUserId: coachForClient,
          clientName: name,
          clientId: row.client_id,
          request,
        })
        coachEmailsSent += 1
      }

      const lastAt = new Date(row.last_engagement_at).getTime()
      const autoEnabled = ws?.auto_checkin_enabled === true
      if (autoEnabled && lastAt < new Date(fourteenDaysAgo).getTime() && row.email) {
        const { data: clRow } = await supabase
          .from('clients')
          .select('last_auto_checkin_at')
          .eq('id', row.client_id)
          .maybeSingle()
        const lastAuto = clRow?.last_auto_checkin_at
          ? new Date(clRow.last_auto_checkin_at as string).getTime()
          : 0
        const canAuto = !lastAuto || now.getTime() - lastAuto > 7 * MS_DAY
        if (canAuto) {
          const coachUserId = await resolveCoachUserIdForClientRow({
            workspace_id: workspaceId,
            coach_id: row.coach_id,
          })
          if (coachUserId) {
            const first = row.first_name?.trim() || 'there'
            const body = formatAutoCheckinMessage(
              (ws?.auto_checkin_message as string | null) ?? '',
              first
            )
            const sent = await insertCoachThreadMessageAsCoach({
              workspaceId,
              clientId: row.client_id,
              coachUserId,
              content: body,
              messageType: 'text',
            })
            if (sent.ok) {
              await supabase
                .from('clients')
                .update({ last_auto_checkin_at: now.toISOString() })
                .eq('id', row.client_id)
                .eq('workspace_id', workspaceId)
              autoMessagesSent += 1
            }
          }
        }
      }
    }

    const { data: milestoneClients } = await supabase
      .from('clients')
      .select('id, first_name, last_name, email, coach_id, created_at')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .lte('created_at', thirtyDaysAgo)

    const service = createServiceClient()
    for (const c of milestoneClients ?? []) {
      const { count: testimonialCount } = await supabase
        .from('testimonials')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', c.id)

      if ((testimonialCount ?? 0) > 0) continue

      const { count: sessionCount } = await service
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', c.id)
        .eq('status', 'completed')

      if ((sessionCount ?? 0) < 3) continue

      const acquired = await tryAcquireNotifyDedupeKey(`testimonial-30d:${c.id}`, 90 * 24 * 60 * 60)
      if (!acquired) continue

      const coachUserId = await resolveCoachUserIdForClientRow({
        workspace_id: workspaceId,
        coach_id: c.coach_id,
      })
      if (!coachUserId || !c.email) continue

      const payload = JSON.stringify({
        type: 'testimonial_request',
        programName: null,
        reason: 'thirty_day',
      })
      const sent = await insertCoachThreadMessageAsCoach({
        workspaceId,
        clientId: c.id,
        coachUserId,
        content: payload,
        messageType: 'testimonial_request',
      })
      if (sent.ok) testimonialPromptsSent += 1
    }

    return NextResponse.json({
      data: {
        inactiveScanned: inactive.length,
        coachEmailsSent,
        autoMessagesSent,
        testimonialPromptsSent,
      },
    })
  } catch (e) {
    console.error('POST /api/coach/re-engagement', e)
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
