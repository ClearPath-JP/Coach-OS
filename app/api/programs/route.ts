import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { invalidateProgramsListCache, programsListCacheKey, withCache } from '@/lib/api-cache'
import { createProgramSchema } from '@/lib/validations'
import { checkRateLimitAsync } from '@/lib/rate-limit'

/**
 * GET /api/programs — all programs for the coach's workspace.
 * Query: ?status=draft|published|archived
 */
export async function GET(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`programs-get:${user.id}`, {
      windowMs: 60_000,
      max: 100,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')?.trim()
    const statusKey = status && ['draft', 'published', 'archived'].includes(status) ? status : 'all'

    const cacheKey = programsListCacheKey(workspaceId, statusKey)
    const data = await withCache(cacheKey, 30, async () => {
      let query = supabase
        .from('programs')
        .select('id, workspace_id, coach_id, title, description, thumbnail_url, status, total_modules, created_at, updated_at')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false })

      if (status && ['draft', 'published', 'archived'].includes(status)) {
        query = query.eq('status', status)
      }

      const { data: programs, error } = await query
      if (error) throw new Error(error.message)
      const list = programs ?? []
      if (list.length === 0) return []
      const programIds = list.map((p) => p.id)
      const { data: assignments } = await supabase
        .from('client_programs')
        .select('program_id')
        .in('program_id', programIds)
      const assignedCountByProgram: Record<string, number> = {}
      for (const a of assignments ?? []) {
        assignedCountByProgram[a.program_id] = (assignedCountByProgram[a.program_id] ?? 0) + 1
      }
      return list.map((p) => ({
        ...p,
        assigned_count: assignedCountByProgram[p.id] ?? 0,
      }))
    })

    const res = NextResponse.json({ data })
    res.headers.set('Cache-Control', 'private, max-age=30')
    return res
  } catch (e) {
    console.error('GET /api/programs', e)
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/programs — create program in draft status. Coach only.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`api-programs:${user.id}`, {
      windowMs: 60_000,
      max: 100,
    })
    if (!rateOk) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json()
    const parsed = createProgramSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { data: row, error } = await supabase
      .from('programs')
      .insert({
        workspace_id: workspaceId,
        coach_id: user.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        thumbnail_url: parsed.data.thumbnail_url ?? null,
        status: 'draft',
        total_modules: 0,
      })
      .select('id, workspace_id, coach_id, title, description, thumbnail_url, status, total_modules, created_at, updated_at')
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Could not create program' },
        { status: 500 }
      )
    }
    void invalidateProgramsListCache(workspaceId)
    return NextResponse.json({ data: row })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
