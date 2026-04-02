import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'

const MS_DAY = 24 * 60 * 60 * 1000

type StaleRow = {
  client_id: string
  first_name: string | null
  last_name: string | null
  last_message_at: string | null
}

type NearRow = {
  client_id: string
  first_name: string | null
  last_name: string | null
  client_program_id: string
  program_title: string | null
  completed_count: number
  total_modules: number
  completion_ratio: number
}

/**
 * GET /api/coach/dashboard-attention — parallel snapshot for "Needs attention" dashboard strip.
 */
export async function GET() {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`coach-dashboard-attention:${user.id}`, {
      windowMs: 60_000,
      max: 60,
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
    const fiveDaysAgo = new Date(now.getTime() - 5 * MS_DAY).toISOString()
    const dayAhead = new Date(now.getTime() + 24 * MS_DAY).toISOString()

    const [
      staleRes,
      overdueRes,
      invoicesRes,
      sessionsRes,
      nearRes,
    ] = await Promise.all([
      supabase.rpc('get_coach_stale_thread_clients', {
        p_workspace_id: workspaceId,
        p_coach_user_id: user.id,
        p_before: sevenDaysAgo,
        p_limit: 3,
      }),
      supabase
        .from('client_assignments')
        .select(
          `id, due_at, client_id,
          assignment_templates ( title ),
          clients ( first_name, last_name )`
        )
        .eq('workspace_id', workspaceId)
        .in('status', ['pending', 'overdue', 'returned'])
        .not('due_at', 'is', null)
        .lt('due_at', now.toISOString())
        .order('due_at', { ascending: true })
        .limit(3),
      supabase
        .from('session_invoices')
        .select(
          `id, amount_cents, created_at, client_id,
          clients ( first_name, last_name )`
        )
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending')
        .lt('created_at', fiveDaysAgo)
        .order('created_at', { ascending: true })
        .limit(3),
      supabase
        .from('sessions')
        .select(
          `id, scheduled_time, duration_minutes, session_type, client_id,
          clients ( first_name, last_name )`
        )
        .eq('workspace_id', workspaceId)
        .eq('coach_id', user.id)
        .in('status', ['pending', 'confirmed'])
        .gte('scheduled_time', now.toISOString())
        .lte('scheduled_time', dayAhead)
        .order('scheduled_time', { ascending: true })
        .limit(5),
      supabase.rpc('get_coach_near_complete_programs', {
        p_workspace_id: workspaceId,
        p_coach_user_id: user.id,
        p_ratio: 0.8,
        p_limit: 3,
      }),
    ])

    const staleRows = (staleRes.data ?? []) as StaleRow[]
    const inactive = staleRows.map((r) => ({
      clientId: r.client_id,
      firstName: r.first_name,
      lastName: r.last_name,
      lastMessageAt: r.last_message_at,
    }))

    const overdue =
      overdueRes.data?.map((r: Record<string, unknown>) => {
        const tpl = r.assignment_templates as { title?: string | null } | null
        const cl = r.clients as { first_name?: string | null; last_name?: string | null } | null
        return {
          id: r.id as string,
          dueAt: r.due_at as string,
          clientId: r.client_id as string,
          templateTitle: tpl?.title ?? null,
          firstName: cl?.first_name ?? null,
          lastName: cl?.last_name ?? null,
        }
      }) ?? []

    const unpaidInvoices =
      invoicesRes.data?.map((r: Record<string, unknown>) => {
        const cl = r.clients as { first_name?: string | null; last_name?: string | null } | null
        return {
          id: r.id as string,
          amountCents: r.amount_cents as number,
          createdAt: r.created_at as string,
          clientId: r.client_id as string,
          firstName: cl?.first_name ?? null,
          lastName: cl?.last_name ?? null,
        }
      }) ?? []

    const sessions24h =
      sessionsRes.data?.map((r: Record<string, unknown>) => {
        const cl = r.clients as { first_name?: string | null; last_name?: string | null } | null
        return {
          id: r.id as string,
          scheduledTime: r.scheduled_time as string,
          durationMinutes: r.duration_minutes as number | null,
          sessionType: r.session_type as string | null,
          clientId: r.client_id as string,
          firstName: cl?.first_name ?? null,
          lastName: cl?.last_name ?? null,
        }
      }) ?? []

    const nearRows = (nearRes.data ?? []) as unknown as NearRow[]
    const nearComplete = nearRows.map((r) => ({
      clientId: r.client_id,
      clientProgramId: r.client_program_id,
      firstName: r.first_name,
      lastName: r.last_name,
      programTitle: r.program_title,
      completedCount: Number(r.completed_count),
      totalModules: r.total_modules,
      completionRatio: r.completion_ratio,
    }))

    const res = NextResponse.json({
      data: {
        inactive,
        overdue,
        unpaidInvoices,
        sessions24h,
        nearComplete,
        rpcErrors: {
          stale: staleRes.error?.message ?? null,
          near: nearRes.error?.message ?? null,
        },
      },
    })
    res.headers.set('Cache-Control', 'private, max-age=30')
    return res
  } catch (e) {
    console.error('GET /api/coach/dashboard-attention', e)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
