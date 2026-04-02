import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase/service'
import { insertCoachThreadMessageAsCoach } from '@/lib/messages/insert-thread-message'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { resolveCoachUserIdForClientRow } from '@/lib/resolve-coach-user-for-client'
import { XP_ACTIONS, levelNumberFromXp } from '@/lib/xp-system'
import { normalizeEmail } from '@/lib/utils'

type RouteContext = { params: Promise<{ moduleId: string }> }

async function countCompletedModules(
  service: ReturnType<typeof createServiceClient>,
  clientProgramId: string
): Promise<number> {
  const { count, error } = await service
    .from('program_progress')
    .select('id', { count: 'exact', head: true })
    .eq('client_program_id', clientProgramId)
    .not('completed_at', 'is', null)
  if (error) return 0
  return count ?? 0
}

async function maybeAwardProgramCompleteBonus(params: {
  service: ReturnType<typeof createServiceClient>
  clientProgramId: string
  programId: string
  clientId: string
  workspaceId: string
  beforeCompletedCount: number
}): Promise<{ completed: boolean; bonusXp: number }> {
  const { service, clientProgramId, programId, clientId, workspaceId, beforeCompletedCount } = params
  const { data: program } = await service
    .from('programs')
    .select('total_modules')
    .eq('id', programId)
    .maybeSingle()
  const total = program?.total_modules ?? 0
  if (total <= 0) return { completed: false, bonusXp: 0 }

  const after = await countCompletedModules(service, clientProgramId)
  if (after !== total || beforeCompletedCount !== total - 1) {
    return { completed: false, bonusXp: 0 }
  }

  const bonusXp = XP_ACTIONS.PROGRAM_COMPLETE
  const nowIso = new Date().toISOString()
  const { data: rewards } = await service
    .from('client_rewards')
    .select('id, total_xp')
    .eq('client_id', clientId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  const nextXp = (rewards?.total_xp ?? 0) + bonusXp
  if (rewards?.id) {
    await service
      .from('client_rewards')
      .update({
        total_xp: nextXp,
        level: levelNumberFromXp(nextXp),
        last_activity_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', rewards.id)
  } else {
    await service.from('client_rewards').insert({
      workspace_id: workspaceId,
      client_id: clientId,
      total_xp: nextXp,
      level: levelNumberFromXp(nextXp),
      last_activity_at: nowIso,
      assignments_total: 0,
      updated_at: nowIso,
    })
  }

  return { completed: true, bonusXp }
}

/**
 * POST /api/progress/[moduleId]/complete — client marks a module complete. Creates program_progress. Client only.
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { moduleId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role === 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`api-progress:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id, workspace_id, coach_id')
      .eq('email', normalizeEmail(user.email))
      .limit(1)
      .maybeSingle()
    if (!client) {
      return NextResponse.json({ error: "We couldn't find your client record" }, { status: 403 })
    }

    const { data: mod } = await supabase.from('program_modules').select('id, program_id').eq('id', moduleId).single()
    if (!mod) {
      return NextResponse.json({ error: "We couldn't find that module" }, { status: 404 })
    }

    const { data: clientProgram } = await supabase
      .from('client_programs')
      .select('id')
      .eq('program_id', mod.program_id)
      .eq('client_id', client.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!clientProgram) {
      return NextResponse.json({ error: "You don't have access to this program" }, { status: 403 })
    }

    const service = createServiceClient()
    const beforeCompleted = await countCompletedModules(service, clientProgram.id)

    const { data: existing } = await supabase
      .from('program_progress')
      .select('id, completed_at')
      .eq('client_program_id', clientProgram.id)
      .eq('module_id', moduleId)
      .maybeSingle()

    if (existing) {
      if (existing.completed_at) {
        return NextResponse.json({ data: { alreadyCompleted: true } })
      }
      const { data: updated, error: updateErr } = await supabase
        .from('program_progress')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('id, completed_at')
        .single()
      if (updateErr) {
        return NextResponse.json({ error: 'Could not update progress' }, { status: 500 })
      }
      const bonus = await maybeAwardProgramCompleteBonus({
        service,
        clientProgramId: clientProgram.id,
        programId: mod.program_id,
        clientId: client.id,
        workspaceId: client.workspace_id,
        beforeCompletedCount: beforeCompleted,
      })
      if (bonus.completed) {
        const { data: prog } = await service
          .from('programs')
          .select('title')
          .eq('id', mod.program_id)
          .maybeSingle()
        const coachUserId = await resolveCoachUserIdForClientRow({
          workspace_id: client.workspace_id,
          coach_id: client.coach_id,
        })
        if (coachUserId) {
          const programName = prog?.title?.trim() || 'your program'
          const payload = JSON.stringify({
            type: 'testimonial_request',
            programId: mod.program_id,
            programName,
            reason: 'program_complete',
          })
          void insertCoachThreadMessageAsCoach({
            workspaceId: client.workspace_id,
            clientId: client.id,
            coachUserId,
            content: payload,
            messageType: 'testimonial_request',
          })
        }
      }
      return NextResponse.json({
        data: { ...updated, ...bonus },
      })
    }

    const { data: row, error } = await supabase
      .from('program_progress')
      .insert({
        workspace_id: client.workspace_id,
        client_program_id: clientProgram.id,
        module_id: moduleId,
        client_id: client.id,
        completed_at: new Date().toISOString(),
      })
      .select('id, module_id, completed_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ data: { alreadyCompleted: true } })
      }
      return NextResponse.json({ error: 'Could not save progress' }, { status: 500 })
    }

    const bonus = await maybeAwardProgramCompleteBonus({
      service,
      clientProgramId: clientProgram.id,
      programId: mod.program_id,
      clientId: client.id,
      workspaceId: client.workspace_id,
      beforeCompletedCount: beforeCompleted,
    })

    if (bonus.completed) {
      const { data: prog } = await service
        .from('programs')
        .select('title')
        .eq('id', mod.program_id)
        .maybeSingle()
      const coachUserId = await resolveCoachUserIdForClientRow({
        workspace_id: client.workspace_id,
        coach_id: client.coach_id,
      })
      if (coachUserId) {
        const programName = prog?.title?.trim() || 'your program'
        const payload = JSON.stringify({
          type: 'testimonial_request',
          programId: mod.program_id,
          programName,
          reason: 'program_complete',
        })
        void insertCoachThreadMessageAsCoach({
          workspaceId: client.workspace_id,
          clientId: client.id,
          coachUserId,
          content: payload,
          messageType: 'testimonial_request',
        })
      }
    }

    return NextResponse.json({ data: { ...row, ...bonus } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
