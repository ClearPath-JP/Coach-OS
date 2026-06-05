import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { CreateScheduleSchema } from '@/lib/studio/scheduled'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { workspaceId, supabase } = auth
  const { data, error } = await supabase
    .from('scheduled_posts')
    .select('id, video_id, project_id, platforms, caption, scheduled_at, mode, status, posted_at, error')
    .eq('workspace_id', workspaceId)
    .order('scheduled_at', { ascending: true })
  if (error) return NextResponse.json({ error: 'Could not load scheduled posts' }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { user, workspaceId } = auth
  const parsed = CreateScheduleSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const { videoId, projectId, platforms, caption, scheduledAt } = parsed.data
  const service = createServiceClient()
  // Verify the video belongs to this workspace (never trust a client id).
  const { data: vid } = await service
    .from('videos')
    .select('id')
    .eq('id', videoId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (!vid) return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  const { data, error } = await service
    .from('scheduled_posts')
    .insert({
      workspace_id: workspaceId,
      coach_id: user.id,
      video_id: videoId,
      project_id: projectId ?? null,
      platforms,
      caption,
      scheduled_at: scheduledAt,
    })
    .select('id')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Could not schedule' }, { status: 500 })
  return NextResponse.json({ data: { id: data.id } }, { status: 201 })
}
