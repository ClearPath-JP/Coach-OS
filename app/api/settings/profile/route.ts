import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { updateProfileSettingsSchema } from '@/lib/validations'

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateProfileSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (parsed.data.firstName !== undefined || parsed.data.lastName !== undefined) {
      const fullName = [parsed.data.firstName ?? '', parsed.data.lastName ?? ''].join(' ').trim()
      updates.full_name = fullName || null
    }
    if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone
    if (parsed.data.avatarUrl !== undefined) updates.logo_url = parsed.data.avatarUrl

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ data: 'No changes' })
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)

    if (error) return NextResponse.json({ error: error.message || 'Could not update profile settings' }, { status: 500 })
    return NextResponse.json({ data: 'Profile settings updated' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
