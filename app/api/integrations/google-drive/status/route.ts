import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

/**
 * GET — whether this workspace has Google Drive connected for server-side import.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const service = createServiceClient()
    const { data: coach } = await service
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!coach?.workspace_id) {
      return NextResponse.json({ connected: false, email: null })
    }

    const { data: row } = await service
      .from('google_drive_connections')
      .select('google_email')
      .eq('workspace_id', coach.workspace_id)
      .maybeSingle()

    return NextResponse.json({
      connected: Boolean(row),
      email: row?.google_email ?? null,
    })
  } catch (error) {
    console.error('[GET /api/integrations/google-drive/status]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
