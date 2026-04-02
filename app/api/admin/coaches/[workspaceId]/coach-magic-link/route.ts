import { NextResponse } from 'next/server'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import { getAdminAppOrigin } from '@/lib/admin-app-origin'
import { createServiceClient } from '@/lib/supabase/service'

type Ctx = { params: Promise<{ workspaceId: string }> }

/**
 * POST — generate a one-time magic link for the workspace coach (support / “view as coach”).
 * Security: ADMIN_EMAIL only; always audit-logged. Opening the link signs in as that user.
 */
export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth
    const { workspaceId } = await context.params
    const service = createServiceClient()

    const { data: coachRow } = await service
      .from('coaches')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (!coachRow?.user_id) {
      return NextResponse.json({ error: 'Coach not found for workspace' }, { status: 404 })
    }

    const { data: profile } = await service
      .from('profiles')
      .select('email, role')
      .eq('id', coachRow.user_id)
      .maybeSingle()
    const email = profile?.email?.trim()
    if (!email) {
      return NextResponse.json({ error: 'Coach has no email on file' }, { status: 400 })
    }
    if (profile?.role !== 'coach') {
      return NextResponse.json({ error: 'Workspace owner is not a coach profile' }, { status: 400 })
    }

    const origin = getAdminAppOrigin()
    const redirectTo = `${origin}/coach/dashboard`

    const { data, error } = await service.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    })

    if (error || !data?.properties?.action_link) {
      return NextResponse.json(
        { error: 'Could not generate sign-in link' },
        { status: 500 }
      )
    }

    await logAdminAudit({
      action: 'admin.coach_magic_link.issued',
      userId: auth.id,
      workspaceId,
      request,
      metadata: { coachUserId: coachRow.user_id },
    })

    return NextResponse.json({
      data: {
        actionLink: data.properties.action_link,
        /** Hint for UI copy */
        expiresNote: 'This link is single-use. Prefer a private browser window so your admin session stays intact.',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Could not create coach access link' }, { status: 500 })
  }
}
