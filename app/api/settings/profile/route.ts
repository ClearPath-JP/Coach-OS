import { NextResponse } from 'next/server'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { createClient } from '@/lib/supabase-server'
import { updateProfileSettingsSchema } from '@/lib/validations'

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
    if (!workspaceId) {
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

    const syncCoachProfile =
      parsed.data.avatarUrl !== undefined || parsed.data.bio !== undefined
    if (syncCoachProfile) {
      const cpRow: Record<string, unknown> = {
        coach_id: user.id,
        workspace_id: workspaceId,
        updated_at: new Date().toISOString(),
      }
      if (parsed.data.avatarUrl !== undefined) {
        cpRow.profile_image_url = parsed.data.avatarUrl
      }
      if (parsed.data.bio !== undefined) {
        cpRow.bio = parsed.data.bio
      }
      const { error: cpError } = await supabase
        .from('coach_profiles')
        .upsert(cpRow, { onConflict: 'coach_id' })
      if (cpError) {
        return NextResponse.json(
          { error: cpError.message || 'Could not sync coach profile for clients' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ data: 'Profile settings updated' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
