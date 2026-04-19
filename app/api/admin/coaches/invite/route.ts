import { NextResponse } from 'next/server'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/service'
import crypto from 'crypto'

/** Generate a readable temp password like "Coach-a7f3b2" */
function generateTempPassword(): string {
  return `Coach-${crypto.randomBytes(3).toString('hex')}`
}

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

    // Check if user already exists
    const { data: existingUsers } = await service.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email
    )

    let userId: string
    let tempPassword: string | null = null

    if (existingUser) {
      const { data: existingCoach } = await service
        .from('coaches')
        .select('workspace_id')
        .eq('user_id', existingUser.id)
        .maybeSingle()
      if (existingCoach?.workspace_id) {
        return NextResponse.json(
          { error: 'A coach with this email already exists.' },
          { status: 400 }
        )
      }
      // Existing user without workspace — set a temp password and flag for reset
      tempPassword = generateTempPassword()
      await service.auth.admin.updateUserById(existingUser.id, {
        password: tempPassword,
        user_metadata: {
          ...existingUser.user_metadata,
          role: 'coach',
          full_name: fullName || existingUser.user_metadata?.full_name,
          must_change_password: true,
        },
      })
      userId = existingUser.id
    } else {
      tempPassword = generateTempPassword()
      const { data: newUser, error: createError } = await service.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          role: 'coach',
          full_name: fullName || undefined,
          must_change_password: true,
        },
      })

      if (createError || !newUser.user) {
        console.error('[admin.coach.invite] createUser error:', createError?.message)
        return NextResponse.json(
          { error: 'Could not create user account. Please try again.' },
          { status: 500 }
        )
      }
      userId = newUser.user.id
    }

    // Create workspace (idempotent)
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
          plan: 'free',
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

    // Upsert profile
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

    // Link coach to workspace
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

    return NextResponse.json({
      ok: true,
      userId,
      workspaceId,
      tempPassword,
      message: `Coach account created for ${email}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
