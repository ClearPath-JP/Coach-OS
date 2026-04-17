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
      const errLower = (inviteError.message ?? '').toLowerCase()
      const isExists = errLower.includes('already') || errLower.includes('exists') || errLower.includes('registered')
      console.error('[admin.coach.invite] inviteUserByEmail error:', inviteError.message)
      return NextResponse.json(
        { error: isExists ? 'A user with this email already exists.' : 'Could not send invite. Please try again.' },
        { status: 400 }
      )
    }

    const userId = inviteData.user.id

    // Create workspace first (idempotent — check if one already exists for this user)
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
        console.error('[admin.coach.invite] workspace creation failed:', wsError.message)
        return NextResponse.json(
          { error: 'Could not create workspace. Please try again.' },
          { status: 500 }
        )
      }
      workspaceId = newWorkspace.id
    }

    // Upsert profile with coach role AND workspace_id (ensures resolveCoachWorkspaceIdForSession works)
    const { error: profileError } = await service.from('profiles').upsert(
      {
        id: userId,
        email,
        full_name: fullName || null,
        role: 'coach',
        workspace_id: workspaceId,
      },
      { onConflict: 'id' }
    )
    if (profileError) {
      console.error('[admin.coach.invite] profile upsert failed:', profileError.message)
      return NextResponse.json(
        { error: 'Could not create coach profile. Please try again.' },
        { status: 500 }
      )
    }

    // Link coach to workspace (upsert so re-invites are safe)
    const { error: coachLinkError } = await service.from('coaches').upsert(
      {
        user_id: userId,
        workspace_id: workspaceId,
        role: 'owner',
      },
      { onConflict: 'user_id,workspace_id' }
    )
    if (coachLinkError) {
      console.error('[admin.coach.invite] coach link failed:', coachLinkError.message)
      return NextResponse.json(
        { error: 'Could not link coach to workspace. Please try again.' },
        { status: 500 }
      )
    }

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
