import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { assignmentSubmitSchema } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/service'
import { XP_ACTIONS, levelNumberFromXp } from '@/lib/xp-system'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/client/assignments/[id]/submit — create submission, mark submitted, +XP, notify coach.
 */
export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { clientId, workspaceId, supabase, user } = auth
    const { id: clientAssignmentId } = await context.params

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`client-assignment-submit:${user.id}`, {
      windowMs: 60_000,
      max: 40,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = assignmentSubmitSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const d = parsed.data

    const { data: row, error: fetchErr } = await supabase
      .from('client_assignments')
      .select(
        `
        id,
        client_id,
        workspace_id,
        status,
        assignment_templates ( id, title, assignment_type, checklist_items )
      `
      )
      .eq('id', clientAssignmentId)
      .eq('client_id', clientId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    if (row.status !== 'pending' && row.status !== 'returned') {
      return NextResponse.json({ error: 'This assignment cannot be submitted right now' }, { status: 400 })
    }

    const rawTpl = row.assignment_templates as unknown
    const tplRow = Array.isArray(rawTpl) ? rawTpl[0] : rawTpl
    const tpl =
      tplRow && typeof tplRow === 'object' && tplRow !== null && 'assignment_type' in tplRow
        ? (tplRow as {
            id: string
            title: string
            assignment_type: string
            checklist_items: unknown
          })
        : null

    if (tpl && d.submissionType !== tpl.assignment_type) {
      return NextResponse.json({ error: 'Submission type does not match this assignment' }, { status: 400 })
    }

    if (d.submissionType === 'text') {
      const t = (d.textContent ?? '').trim()
      if (t.length < 20) {
        return NextResponse.json({ error: 'Please write at least 20 characters' }, { status: 400 })
      }
    }

    if (d.submissionType === 'checklist') {
      const items = Array.isArray(tpl?.checklist_items)
        ? (tpl.checklist_items as string[])
        : []
      const resp = d.checklistResponses ?? {}
      for (const item of items) {
        if (resp[item] !== true) {
          return NextResponse.json({ error: 'Complete every checklist item before submitting' }, { status: 400 })
        }
      }
    }

    if (d.submissionType === 'video' && !d.videoId) {
      return NextResponse.json({ error: 'Add a video before submitting' }, { status: 400 })
    }

    if (d.submissionType === 'file' && !d.fileUrl) {
      return NextResponse.json({ error: 'Add a file before submitting' }, { status: 400 })
    }

    if (d.videoId) {
      const { data: vid } = await supabase
        .from('videos')
        .select('id, workspace_id')
        .eq('id', d.videoId)
        .maybeSingle()
      if (!vid || vid.workspace_id !== workspaceId) {
        return NextResponse.json({ error: 'Invalid video' }, { status: 400 })
      }
    }

    const { data: lastSub } = await supabase
      .from('assignment_submissions')
      .select('version')
      .eq('client_assignment_id', clientAssignmentId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersion = (lastSub?.version ?? 0) + 1

    const { data: submission, error: subErr } = await supabase
      .from('assignment_submissions')
      .insert({
        client_assignment_id: clientAssignmentId,
        workspace_id: workspaceId,
        client_id: clientId,
        submission_type: d.submissionType,
        text_content: d.textContent ?? null,
        video_id: d.videoId ?? null,
        file_url: d.fileUrl ?? null,
        file_size_bytes: d.fileSizeBytes ?? null,
        checklist_responses: d.checklistResponses ?? null,
        version: nextVersion,
      })
      .select('id, version, created_at')
      .single()

    if (subErr) {
      return NextResponse.json({ error: subErr.message || 'Could not save submission' }, { status: 500 })
    }

    const nowIso = new Date().toISOString()
    const { error: upErr } = await supabase
      .from('client_assignments')
      .update({
        status: 'submitted',
        submitted_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', clientAssignmentId)

    if (upErr) {
      return NextResponse.json({ error: 'Saved submission but could not update assignment status' }, { status: 500 })
    }

    const service = createServiceClient()
    const { data: rewards } = await service
      .from('client_rewards')
      .select('id, total_xp, assignments_total')
      .eq('client_id', clientId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    const addXp = XP_ACTIONS.ASSIGNMENT_SUBMITTED
    if (rewards) {
      const nextXp = (rewards.total_xp ?? 0) + addXp
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
      const nextXp = addXp
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

    const { data: clientRow } = await supabase
      .from('clients')
      .select('coach_id')
      .eq('id', clientId)
      .maybeSingle()

    if (clientRow?.coach_id) {
      const title = tpl?.title ?? 'Assignment'
      await supabase.from('messages').insert({
        workspace_id: workspaceId,
        sender_id: user.id,
        recipient_id: clientRow.coach_id,
        client_id: clientId,
        content: `Submitted: ${title}`,
        message_type: 'text',
      })
    }

    return NextResponse.json({
      data: {
        submission,
        xpAwarded: addXp,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}
