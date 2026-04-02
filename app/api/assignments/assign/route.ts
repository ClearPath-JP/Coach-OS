import { NextResponse } from 'next/server'
import { addDays } from 'date-fns'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { assignToClientSchema } from '@/lib/validations'
import { normalizeEmail } from '@/lib/utils'
import { checkAssignmentsPerClientLimit } from '@/lib/plan-limits'

/**
 * POST /api/assignments/assign — create client_assignment, bump rewards total, message client (coach).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`assignments-assign:${user.id}`, {
      windowMs: 60_000,
      max: 60,
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

    const parsed = assignToClientSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { templateId, clientId, clientProgramId, dueAt } = parsed.data

    const { allowed, max } = await checkAssignmentsPerClientLimit(workspaceId, clientId)
    if (!allowed) {
      return NextResponse.json(
        { error: `This client already has the maximum assignments for your plan (${max}).` },
        { status: 400 }
      )
    }

    const { data: tpl, error: tplErr } = await supabase
      .from('assignment_templates')
      .select(
        'id, title, instructions, assignment_type, checklist_items, due_days_after_assign, points, deleted_at'
      )
      .eq('id', templateId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (tplErr || !tpl || tpl.deleted_at) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const { data: client, error: clErr } = await supabase
      .from('clients')
      .select('id, email, workspace_id')
      .eq('id', clientId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (clErr || !client?.email) {
      return NextResponse.json(
        { error: "This client needs an email and portal access before you can assign work in chat." },
        { status: 400 }
      )
    }

    const emailNorm = normalizeEmail(client.email)
    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', emailNorm)
      .maybeSingle()

    if (!clientProfile?.id) {
      return NextResponse.json(
        { error: "This client doesn't have a login yet — create their account before assigning in the app." },
        { status: 400 }
      )
    }

    if (clientProgramId) {
      const { data: cp } = await supabase
        .from('client_programs')
        .select('id')
        .eq('id', clientProgramId)
        .eq('client_id', clientId)
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      if (!cp) {
        return NextResponse.json({ error: 'Program assignment not found for this client' }, { status: 400 })
      }
    }

    const due =
      dueAt != null && dueAt !== ''
        ? new Date(dueAt).toISOString()
        : addDays(new Date(), tpl.due_days_after_assign ?? 7).toISOString()

    const { data: assignment, error: insErr } = await supabase
      .from('client_assignments')
      .insert({
        workspace_id: workspaceId,
        assignment_template_id: templateId,
        client_id: clientId,
        client_program_id: clientProgramId ?? null,
        assigned_by: user.id,
        status: 'pending',
        due_at: due,
      })
      .select('id, status, due_at, created_at')
      .single()

    if (insErr) {
      return NextResponse.json({ error: 'Could not create assignment' }, { status: 500 })
    }

    const { data: rewards } = await supabase
      .from('client_rewards')
      .select('id, assignments_total')
      .eq('client_id', clientId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (rewards) {
      await supabase
        .from('client_rewards')
        .update({
          assignments_total: (rewards.assignments_total ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rewards.id)
    } else {
      await supabase.from('client_rewards').insert({
        workspace_id: workspaceId,
        client_id: clientId,
        assignments_total: 1,
        updated_at: new Date().toISOString(),
      })
    }

    const checklistRaw = tpl.checklist_items
    const checklistItems = Array.isArray(checklistRaw)
      ? (checklistRaw as unknown[]).filter((x): x is string => typeof x === 'string')
      : null

    const card = {
      type: 'assignment',
      clientAssignmentId: assignment.id,
      templateId: tpl.id,
      templateTitle: tpl.title,
      assignmentType: tpl.assignment_type,
      instructions: tpl.instructions ?? null,
      checklistItems,
      dueAt: due,
      points: tpl.points,
      status: 'pending',
    }

    const { data: message, error: msgErr } = await supabase
      .from('messages')
      .insert({
        workspace_id: workspaceId,
        sender_id: user.id,
        recipient_id: clientProfile.id,
        client_id: clientId,
        content: JSON.stringify(card),
        message_type: 'assignment',
      })
      .select('id')
      .single()

    if (msgErr) {
      return NextResponse.json(
        { error: 'Assignment created, but the message could not be sent — tell your client in Messages.', data: assignment },
        { status: 207 }
      )
    }

    return NextResponse.json({ data: { ...assignment, messageId: message.id } })
  } catch {
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}
