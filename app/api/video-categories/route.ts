import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { z } from 'zod'
import { CATEGORY_COLORS } from '@/lib/video-category-colors'

const validColors = CATEGORY_COLORS.map((c) => c.key) as [string, ...string[]]

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(60),
  color: z.enum(validColors),
})

const updateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  color: z.enum(validColors).optional(),
  position: z.number().int().min(0).optional(),
})

/** GET /api/video-categories — list all categories for this workspace */
export async function GET() {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { workspaceId, supabase } = auth

  const { data, error } = await supabase
    .from('video_categories')
    .select('id, name, color, position, created_at')
    .eq('workspace_id', workspaceId)
    .order('position', { ascending: true })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: 'Could not load categories' }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

/** POST /api/video-categories — create a new category */
export async function POST(request: Request) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { workspaceId, supabase } = auth

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid' }, { status: 400 })
  }

  // Get next position
  const { count } = await supabase
    .from('video_categories')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  const { data, error } = await supabase
    .from('video_categories')
    .insert({
      workspace_id: workspaceId,
      name: parsed.data.name.trim(),
      color: parsed.data.color,
      position: count ?? 0,
    })
    .select('id, name, color, position, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A category with that name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Could not create category' }, { status: 500 })
  }
  return NextResponse.json({ data })
}

/** PATCH /api/video-categories?id=UUID — update a category */
export async function PATCH(request: Request) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { workspaceId, supabase } = auth

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')?.trim()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim()
  if (parsed.data.color !== undefined) updates.color = parsed.data.color
  if (parsed.data.position !== undefined) updates.position = parsed.data.position

  const { data, error } = await supabase
    .from('video_categories')
    .update(updates)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select('id, name, color, position')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A category with that name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Could not update category' }, { status: 500 })
  }
  return NextResponse.json({ data })
}

/** DELETE /api/video-categories?id=UUID — delete a category (unlinks videos) */
export async function DELETE(request: Request) {
  const auth = await requireCoach()
  if ('error' in auth) return auth.error
  const { workspaceId, supabase } = auth

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')?.trim()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Unlink videos first (category_id → null)
  await supabase
    .from('videos')
    .update({ category_id: null })
    .eq('workspace_id', workspaceId)
    .eq('category_id', id)

  const { error } = await supabase
    .from('video_categories')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (error) return NextResponse.json({ error: 'Could not delete category' }, { status: 500 })
  return NextResponse.json({ data: 'ok' })
}
