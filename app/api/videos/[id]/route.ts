import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { patchVideoSchema } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/service'
import { userCanStreamVideo } from '@/lib/video-stream-access'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/videos/[id] — metadata for playback UI (no Drive file id). Coach or client with access only.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = createServiceClient()
    const { data: video, error } = await service
      .from('videos')
      .select(
        'id, workspace_id, title, description, processing_status, playback_url, thumbnail_url, drive_thumbnail_url, duration_seconds, file_size_bytes, drive_file_id'
      )
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: 'Could not load video' },
        { status: 500 }
      )
    }
    if (!video) {
      return NextResponse.json(
        { error: "We couldn't find that video — it may have been deleted" },
        { status: 404 }
      )
    }

    const row = video as {
      workspace_id: string
      drive_file_id: string | null
      playback_url: string | null
      processing_status: string
    }

    const hasDrive = Boolean(row.drive_file_id)
    const hasLegacyPlayback = Boolean(row.playback_url?.trim())
    if (!hasDrive && !hasLegacyPlayback) {
      return NextResponse.json(
        { error: "We couldn't find that video — it may have been deleted" },
        { status: 404 }
      )
    }

    const allowed = await userCanStreamVideo(user.id, id, row.workspace_id, {
      sessionEmail: user.email ?? null,
    })
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const v = video as {
      id: string
      title: string
      description: string | null
      processing_status: string
      playback_url: string | null
      thumbnail_url: string | null
      drive_thumbnail_url: string | null
      duration_seconds: number | null
      file_size_bytes: number | null
    }

    return NextResponse.json({
      data: {
        id: v.id,
        title: v.title,
        description: v.description,
        processing_status: v.processing_status,
        playback_url: v.playback_url,
        thumbnail_url: v.thumbnail_url,
        drive_thumbnail_url: v.drive_thumbnail_url,
        duration_seconds: v.duration_seconds,
        file_size_bytes: v.file_size_bytes,
        drive_file_id: row.drive_file_id,
        uses_stream_proxy: hasDrive,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/videos/[id] — update title and/or description. Coach only, workspace-scoped.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { workspaceId, supabase, user } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`videos-patch:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const raw = await request.json()
    const parsed = patchVideoSchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join('; ') || 'Invalid body'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const updates: { title?: string; description?: string | null; category?: string | null } = {}
    if (parsed.data.title !== undefined) updates.title = parsed.data.title
    if (parsed.data.description !== undefined) {
      const d = parsed.data.description
      updates.description = d === null || d.trim() === '' ? null : d.trim()
    }
    if (parsed.data.category !== undefined) {
      const c = parsed.data.category
      updates.category = c === null ? null : c.trim() === '' ? null : c.trim()
    }

    const { data: row, error } = await supabase
      .from('videos')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .select('id, title, description, category')
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'Could not update video' }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json(
        { error: "We couldn't find that video — it may have been deleted" },
        { status: 404 }
      )
    }
    return NextResponse.json({ data: row })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/videos/[id] — soft delete (set deleted_at). Coach only.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { workspaceId, supabase, user } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`videos-delete:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { error } = await supabase
      .from('videos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (error) {
      return NextResponse.json({ error: 'Could not delete video' }, { status: 500 })
    }
    return NextResponse.json({ data: 'ok' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
