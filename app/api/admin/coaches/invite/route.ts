import { NextResponse } from 'next/server'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: Request) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth

    const body = (await request.json()) as { email?: string; firstName?: string; lastName?: string }
    const email = (body.email ?? '').trim().toLowerCase()
    const firstName = (body.firstName ?? '').trim()
    const lastName = (body.lastName ?? '').trim()
    const fullName = [firstName, lastName].filter(Boolean).join(' ')

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    const service = createServiceClient()

    // Invite the user via Supabase admin - this sends an invite email
    const { data: inviteData, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
      data: {
        role: 'coach',
        full_name: fullName || undefined,
      },
    })

    if (inviteError) {
      // If user already exists, that's an error we surface
      return NextResponse.json({ error: inviteError.message }, { status: 400 })
    }

    const userId = inviteData.user.id

    // Upsert profile with coach role
    await service.from('profiles').upsert(
      {
        id: userId,
        email,
        full_name: fullName || null,
        role: 'coach',
      },
      { onConflict: 'id' }
    )

    // Create workspace so the coach lands on a ready dashboard after accepting the invite.
    // Check if a workspace already exists for this user (idempotent).
    const { data: existingWorkspace } = await service
      .from('workspaces')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle()

    let workspaceId: string

    if (existingWorkspace) {
      workspaceId = existingWorkspace.id
    } else {
      const { data: newWorkspace, error: wsError } = await service
        .from('workspaces')
        .insert({
          owner_id: userId,
          name: fullName || 'New Coach',
          plan: 'starter',
          status: 'active',
          completed_onboarding: true,
        })
        .select('id')
        .single()

      if (wsError) {
        return NextResponse.json({ error: `Workspace creation failed: ${wsError.message}` }, { status: 500 })
      }
      workspaceId = newWorkspace.id
    }

    // Link coach to workspace (upsert so re-invites are safe)
    await service.from('coaches').upsert(
      {
        user_id: userId,
        workspace_id: workspaceId,
        role: 'owner',
      },
      { onConflict: 'user_id,workspace_id' }
    )

    await logAdminAudit({
      action: 'admin.coach.invite',
      userId: auth.id,
      request,
      metadata: { invitedEmail: email, newUserId: userId, workspaceId },
    })

    return NextResponse.json({ ok: true, userId, workspaceId, message: `Invite sent to ${email}` })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
