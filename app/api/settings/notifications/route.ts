import { NextResponse } from 'next/server'
import { invalidateCoachSettingsCache, invalidateSettingsCachesForWorkspace } from '@/lib/api-cache'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { createClient } from '@/lib/supabase-server'
import { updateNotificationsSchema } from '@/lib/validations'

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
    const parsed = updateNotificationsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const updates: Record<string, boolean> = {}
    if (parsed.data.newMessage !== undefined) updates.notification_new_message = parsed.data.newMessage
    if (parsed.data.sessionReminder !== undefined) updates.notification_session_reminder = parsed.data.sessionReminder
    if (parsed.data.clientActivity !== undefined) updates.notification_client_activity = parsed.data.clientActivity
    if (parsed.data.paymentReceived !== undefined) updates.notification_payment_received = parsed.data.paymentReceived

    const workspaceUpdates: Record<string, unknown> = {}
    if (parsed.data.autoCheckinEnabled !== undefined) {
      workspaceUpdates.auto_checkin_enabled = parsed.data.autoCheckinEnabled
    }
    if (parsed.data.autoCheckinMessage !== undefined) {
      workspaceUpdates.auto_checkin_message = parsed.data.autoCheckinMessage
    }

    if (
      Object.keys(updates).length === 0 &&
      Object.keys(workspaceUpdates).length === 0
    ) {
      return NextResponse.json({ data: 'No changes' })
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
      if (error) return NextResponse.json({ error: 'Could not update notifications' }, { status: 500 })
    }

    if (Object.keys(workspaceUpdates).length > 0) {
      const { error: wErr } = await supabase
        .from('workspaces')
        .update(workspaceUpdates)
        .eq('id', workspaceId)
      if (wErr) {
        return NextResponse.json({ error: 'Could not update automated check-in settings' }, { status: 500 })
      }
      void invalidateSettingsCachesForWorkspace(workspaceId)
    }

    void invalidateCoachSettingsCache(workspaceId, user.id)
    return NextResponse.json({ data: 'Notifications updated' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
