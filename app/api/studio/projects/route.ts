import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { TimelineSchema, ProjectAudioSchema, CAPTION_STYLES, audioPublicPath } from '@/lib/studio/timeline'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { workspaceId, supabase } = auth
  const { data, error } = await supabase.from('video_projects')
    .select('id, title, caption_style, timeline, status, updated_at, last_render_edit_id')
    .eq('workspace_id', workspaceId).order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Could not load projects' }, { status: 500 })
  return NextResponse.json({ data })
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(120).default('Untitled'),
  timeline: TimelineSchema.default([]),
  audio: ProjectAudioSchema.optional(),
  captionStyle: z.enum(CAPTION_STYLES).default('tiktok'),
})

export async function POST(request: Request) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { user, workspaceId } = auth
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  const { title, timeline, audio, captionStyle } = parsed.data
  const safeAudio = audio
    ? { ...audio, music: audioPublicPath(workspaceId, audio.music), voiceover: audioPublicPath(workspaceId, audio.voiceover) }
    : {}
  const service = createServiceClient()
  const { data, error } = await service.from('video_projects').insert({
    workspace_id: workspaceId, coach_id: user.id, title,
    timeline, audio: safeAudio, caption_style: captionStyle,
  }).select('id').single()
  if (error || !data) return NextResponse.json({ error: 'Could not create project' }, { status: 500 })
  return NextResponse.json({ data: { id: data.id } }, { status: 201 })
}
