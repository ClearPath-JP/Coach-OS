import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { bulkVideoCategorySchema } from '@/lib/validations'

/**
 * POST /api/videos/bulk-category — set category on many videos (coach, workspace).
 * Body: { videoIds: uuid[], category: string | null }
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { workspaceId, supabase, user } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`videos-bulk-category:${user.id}`, {
      windowMs: 60_000,
      max: 30,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const raw = await request.json()
    const parsed = bulkVideoCategorySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      )
    }

    const catIn = parsed.data.category
    const category =
      catIn === undefined || catIn === null
        ? null
        : catIn.trim() === ''
          ? null
          : catIn.trim()

    const { data, error } = await supabase
      .from('videos')
      .update({ category })
      .in('id', parsed.data.videoIds)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .select('id')

    if (error) {
      return NextResponse.json(
        { error: 'Could not update videos' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: { updated: (data ?? []).length } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
