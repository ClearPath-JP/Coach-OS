import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { patchPromotePostSchema } from '@/lib/validations'
import { logServerError } from '@/lib/log-server-error'

type RouteContext = { params: Promise<{ id: string }> }

const POST_COLUMNS =
  'id, path, kind, platform, tone, type, content, title, source_video_id, status, posted_at, created_at, updated_at'

/**
 * PATCH /api/coach/promote/posts/[id] — edit content (inline) and/or status (draft|posted).
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`promote-posts-write:${user.id}`, {
      windowMs: 60_000,
      max: 40,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const raw = await request.json().catch(() => null)
    const parsed = patchPromotePostSchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const d = parsed.data

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (d.content !== undefined) {
      // Content shape is union-validated by the schema; ensure it matches the stored post type.
      const { data: existing, error: exErr } = await supabase
        .from('promote_posts')
        .select('type')
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      if (exErr) return NextResponse.json({ error: 'Could not update post' }, { status: 500 })
      if (!existing) {
        return NextResponse.json({ error: "We couldn't find that post" }, { status: 404 })
      }
      const isPostShape = typeof d.content === 'object' && d.content !== null && 'hook' in d.content
      if ((existing.type === 'post') !== isPostShape) {
        return NextResponse.json({ error: 'Content does not match this post type' }, { status: 400 })
      }
      updates.content = d.content
    }

    if (d.status !== undefined) {
      updates.status = d.status
      updates.posted_at = d.status === 'posted' ? new Date().toISOString() : null
    }

    if (d.title !== undefined) {
      updates.title = d.title === null ? null : d.title.trim().slice(0, 200) || null
    }

    const { data, error } = await supabase
      .from('promote_posts')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(POST_COLUMNS)
      .maybeSingle()

    if (error) return NextResponse.json({ error: 'Could not update post' }, { status: 500 })
    if (!data) return NextResponse.json({ error: "We couldn't find that post" }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    await logServerError('PATCH /api/coach/promote/posts/[id]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

/**
 * DELETE /api/coach/promote/posts/[id] — remove a saved post.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { workspaceId, supabase } = auth

    const { error } = await supabase
      .from('promote_posts')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (error) return NextResponse.json({ error: 'Could not delete post' }, { status: 500 })
    return NextResponse.json({ data: 'ok' })
  } catch (err) {
    await logServerError('DELETE /api/coach/promote/posts/[id]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
