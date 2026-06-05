import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { PatchScheduleSchema } from '@/lib/studio/scheduled'

export const runtime = 'nodejs'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { workspaceId } = auth
  const { id } = await params
  const parsed = PatchScheduleSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.platforms !== undefined) patch.platforms = parsed.data.platforms
  if (parsed.data.caption !== undefined) patch.caption = parsed.data.caption
  if (parsed.data.scheduledAt !== undefined) patch.scheduled_at = parsed.data.scheduledAt
  if (parsed.data.status !== undefined) patch.status = parsed.data.status
  const service = createServiceClient()
  const { data, error } = await service
    .from('scheduled_posts')
    .update(patch)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not update' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: { ok: true } })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { workspaceId } = auth
  const { id } = await params
  const service = createServiceClient()
  const { data, error } = await service
    .from('scheduled_posts')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not delete' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: { ok: true } })
}
