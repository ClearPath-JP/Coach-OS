import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { updateAssignmentTemplateSchema } from '@/lib/validations'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Ctx) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth
    const { id } = await context.params

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`assignments-templates-patch:${user.id}`, {
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

    const parsed = updateAssignmentTemplateSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const d = parsed.data
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (d.title !== undefined) updates.title = d.title
    if (d.instructions !== undefined) updates.instructions = d.instructions
    if (d.assignmentType !== undefined) updates.assignment_type = d.assignmentType
    if (d.checklistItems !== undefined) updates.checklist_items = d.checklistItems
    if (d.dueDaysAfterAssign !== undefined) updates.due_days_after_assign = d.dueDaysAfterAssign
    if (d.points !== undefined) updates.points = d.points
    if (d.isRequired !== undefined) updates.is_required = d.isRequired
    if (d.position !== undefined) updates.position = d.position
    if (d.programId !== undefined) updates.program_id = d.programId
    if (d.moduleId !== undefined) updates.module_id = d.moduleId

    const { data: row, error } = await supabase
      .from('assignment_templates')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(
        'id, title, instructions, assignment_type, checklist_items, due_days_after_assign, points, program_id, module_id, updated_at'
      )
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message || 'Could not update template' }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    return NextResponse.json({ data: row })
  } catch {
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}

/** Soft-delete template (coach) */
export async function DELETE(_request: Request, context: Ctx) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth
    const { id } = await context.params

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`assignments-templates-del:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: row, error } = await supabase
      .from('assignment_templates')
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select('id, deleted_at')
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message || 'Could not delete template' }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    return NextResponse.json({ data: row })
  } catch {
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}
