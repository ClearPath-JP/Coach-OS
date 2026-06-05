import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { savePromotePostSchema } from '@/lib/validations'
import { logServerError } from '@/lib/log-server-error'

const POST_COLUMNS =
  'id, path, kind, platform, tone, type, content, title, source_video_id, status, posted_at, created_at, updated_at'

/** Short shelf label derived from the post/plan content. */
function derivePostTitle(content: Record<string, unknown>): string {
  const pick = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const base = pick(content.hook) || pick(content.hookIdea) || pick(content.caption)
  const firstLine = base.split('\n')[0]?.trim() ?? ''
  return firstLine.slice(0, 80) || 'Untitled post'
}

/**
 * GET /api/coach/promote/posts — list saved posts for the workspace (newest first).
 * Optional ?status=draft|posted.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { workspaceId, supabase } = auth

    const status = new URL(request.url).searchParams.get('status')
    let query = supabase
      .from('promote_posts')
      .select(POST_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (status === 'draft' || status === 'posted') query = query.eq('status', status)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: 'Could not load saved posts' }, { status: 500 })
    }
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    await logServerError('GET /api/coach/promote/posts', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

/**
 * POST /api/coach/promote/posts — save a generated post or video plan as a draft.
 * Body validated by savePromotePostSchema (discriminated on `type`).
 */
export async function POST(request: Request) {
  try {
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
    const parsed = savePromotePostSchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const d = parsed.data
    const title = (d.title?.trim() || derivePostTitle(d.content as Record<string, unknown>)).slice(0, 200)

    const { data, error } = await supabase
      .from('promote_posts')
      .insert({
        workspace_id: workspaceId,
        coach_id: user.id,
        path: d.path,
        kind: d.kind ?? null,
        platform: d.platform ?? null,
        tone: d.tone ?? null,
        type: d.type,
        content: d.content,
        title,
        source_video_id: d.sourceVideoId ?? null,
        status: 'draft',
      })
      .select(POST_COLUMNS)
      .single()

    if (error || !data) {
      await logServerError('POST /api/coach/promote/posts insert', error)
      return NextResponse.json({ error: 'Could not save post' }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (err) {
    await logServerError('POST /api/coach/promote/posts', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
