import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { createAssignmentTemplateSchema } from '@/lib/validations'

/**
 * GET /api/assignments/templates — list templates (coach). Query: programId, moduleId
 */
export async function GET(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`assignments-templates-get:${user.id}`, {
      windowMs: 60_000,
      max: 120,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { searchParams } = new URL(request.url)
    const programId = searchParams.get('programId')?.trim()
    const moduleId = searchParams.get('moduleId')?.trim()

    let q = supabase
      .from('assignment_templates')
      .select(
        'id, workspace_id, coach_id, program_id, module_id, title, instructions, assignment_type, checklist_items, due_days_after_assign, points, is_required, position, deleted_at, created_at, updated_at'
      )
      .eq('workspace_id', workspaceId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })

    if (programId) q = q.eq('program_id', programId)
    if (moduleId) q = q.eq('module_id', moduleId)

    const { data, error } = await q
    if (error) {
      return NextResponse.json({ error: error.message || 'Could not load templates' }, { status: 500 })
    }

    const rows = (data ?? []).filter((r) => r.deleted_at == null)

    const { data: countRows } = await supabase
      .from('client_assignments')
      .select('assignment_template_id')
      .eq('workspace_id', workspaceId)

    const countByTemplate = new Map<string, number>()
    for (const r of countRows ?? []) {
      const tid = r.assignment_template_id as string
      countByTemplate.set(tid, (countByTemplate.get(tid) ?? 0) + 1)
    }

    const withCounts = rows.map((r) => ({
      ...r,
      assignCount: countByTemplate.get(r.id) ?? 0,
    }))

    return NextResponse.json({ data: withCounts })
  } catch {
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}

/**
 * POST /api/assignments/templates — create template (coach)
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`assignments-templates-post:${user.id}`, {
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

    const parsed = createAssignmentTemplateSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const d = parsed.data
    let checklistForDb = d.checklistItems ?? null
    if (d.assignmentType === 'checklist') {
      const items = (d.checklistItems ?? []).map((s) => s.trim()).filter(Boolean)
      if (items.length === 0) {
        return NextResponse.json({ error: 'Add at least one checklist item' }, { status: 400 })
      }
      checklistForDb = items
    }
    if (d.moduleId && d.programId) {
      const { data: mod } = await supabase
        .from('program_modules')
        .select('id, program_id')
        .eq('id', d.moduleId)
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      if (!mod || mod.program_id !== d.programId) {
        return NextResponse.json({ error: 'Module does not belong to that program' }, { status: 400 })
      }
    } else if (d.moduleId) {
      const { data: mod } = await supabase
        .from('program_modules')
        .select('id')
        .eq('id', d.moduleId)
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      if (!mod) {
        return NextResponse.json({ error: 'Module not found' }, { status: 404 })
      }
    } else if (d.programId) {
      const { data: prog } = await supabase
        .from('programs')
        .select('id')
        .eq('id', d.programId)
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      if (!prog) {
        return NextResponse.json({ error: 'Program not found' }, { status: 404 })
      }
    }

    const { data: row, error } = await supabase
      .from('assignment_templates')
      .insert({
        workspace_id: workspaceId,
        coach_id: user.id,
        program_id: d.programId ?? null,
        module_id: d.moduleId ?? null,
        title: d.title,
        instructions: d.instructions ?? null,
        assignment_type: d.assignmentType,
        checklist_items: checklistForDb,
        due_days_after_assign: d.dueDaysAfterAssign,
        points: d.points,
        is_required: d.isRequired,
        position: d.position,
      })
      .select(
        'id, title, instructions, assignment_type, checklist_items, due_days_after_assign, points, program_id, module_id, created_at'
      )
      .single()

    if (error) {
      return NextResponse.json({ error: error.message || 'Could not create template' }, { status: 500 })
    }
    return NextResponse.json({ data: row })
  } catch {
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}
