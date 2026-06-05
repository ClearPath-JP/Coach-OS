import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { TimelineSchema, ProjectAudioSchema, CAPTION_STYLES, audioPublicPath } from '@/lib/studio/timeline'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { workspaceId, supabase } = auth
  const { id } = await params
  const { data, error } = await supabase.from('video_projects')
    .select('id, title, caption_style, timeline, audio, status, updated_at, last_render_edit_id')
    .eq('id', id).eq('workspace_id', workspaceId).single()
  if (error || !data) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  return NextResponse.json({ data })
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  timeline: TimelineSchema.optional(),
  audio: ProjectAudioSchema.optional(),
  captionStyle: z.enum(CAPTION_STYLES).optional(),
}).refine((o) => Object.keys(o).length > 0, { message: 'Nothing to update' })

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { workspaceId } = auth
  const { id } = await params
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.title !== undefined) patch.title = parsed.data.title
  if (parsed.data.timeline !== undefined) patch.timeline = parsed.data.timeline
  if (parsed.data.audio !== undefined) {
    patch.audio = {
      ...parsed.data.audio,
      music: audioPublicPath(workspaceId, parsed.data.audio.music),
      voiceover: audioPublicPath(workspaceId, parsed.data.audio.voiceover),
    }
  }
  if (parsed.data.captionStyle !== undefined) patch.caption_style = parsed.data.captionStyle
  const service = createServiceClient()
  const { data: updated, error } = await service.from('video_projects').update(patch).eq('id', id).eq('workspace_id', workspaceId).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not save project' }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  return NextResponse.json({ data: { ok: true } })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { workspaceId } = auth
  const { id } = await params
  const service = createServiceClient()
  const { data: deleted, error } = await service.from('video_projects').delete().eq('id', id).eq('workspace_id', workspaceId).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not delete project' }, { status: 500 })
  if (!deleted) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  return NextResponse.json({ data: { ok: true } })
}
