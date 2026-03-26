import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireCoach } from '@/lib/api-helpers'
import { addClientSchema } from '@/lib/validations'
import { checkClientLimit } from '@/lib/plan-limits'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { normalizeEmail, sanitizeIlikeSearch } from '@/lib/utils'

function generateTempPassword(): string {
  return (
    Math.random().toString(36).slice(-8).toUpperCase() +
    Math.random().toString(36).slice(-4) +
    '!'
  )
}

/**
 * GET /api/clients — fetch all clients for the coach's workspace.
 * Query: ?search= (name or email), ?status= (active|paused|completed).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`clients-get:${user.id}`, {
      windowMs: 60_000,
      max: 100,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { searchParams } = new URL(request.url)
    const safeSearch = sanitizeIlikeSearch(searchParams.get('search') ?? '')
    const status = searchParams.get('status')?.trim() || ''

    let query = supabase
      .from('clients')
      .select('id, workspace_id, first_name, last_name, email, phone, goals, status, notes, profile_photo_url, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })

    if (status && ['active', 'paused', 'completed'].includes(status)) {
      query = query.eq('status', status)
    }
    if (safeSearch) {
      query = query.or(
        `first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`
      )
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not load clients' },
        { status: 500 }
      )
    }
    const res = NextResponse.json({ data: data ?? [] })
    res.headers.set('Cache-Control', 'private, max-age=30')
    return res
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/clients — create a new client.
 * Body: addClientSchema (firstName, lastName, email, phone?, goals?).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`clients-post:${user.id}`, {
      windowMs: 60_000,
      max: 30,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const limit = await checkClientLimit(workspaceId)
    if (!limit.allowed) {
      const msg = limit.max === null
        ? "You've reached your plan limit for clients. Contact support to add more."
        : `You've reached your plan limit of ${limit.max} clients. Upgrade your plan to add more.`
      return NextResponse.json({ error: msg }, { status: 403 })
    }

    const body = await request.json()
    const parsed = addClientSchema.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors
      const message = Object.values(first).flat().join(' ') || 'Invalid input'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { firstName, lastName, email, phone, goals } = parsed.data
    const emailNorm = email.trim().toLowerCase()
    const tempPassword = generateTempPassword()

    let service
    try {
      service = createServiceClient()
    } catch {
      return NextResponse.json(
        { error: 'Server configuration error — contact support' },
        { status: 503 }
      )
    }

    const { data: existingInWorkspace } = await supabase
      .from('clients')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('email', emailNorm)
      .maybeSingle()
    if (existingInWorkspace) {
      return NextResponse.json(
        { error: 'A client with this email already exists' },
        { status: 400 }
      )
    }

    let newUserId: string
    let createdNewAuthUser = false

    const { data: createdAuth, error: authErr } = await service.auth.admin.createUser({
      email: emailNorm,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        role: 'client',
        workspace_id: workspaceId,
        must_change_password: true,
      },
    })

    if (authErr || !createdAuth.user?.id) {
      const msg = (authErr?.message ?? '').toLowerCase()
      const looksDuplicate =
        msg.includes('already') || msg.includes('registered') || msg.includes('exists')
      if (!looksDuplicate) {
        return NextResponse.json(
          { error: authErr?.message || 'Could not create client account' },
          { status: 500 }
        )
      }
      const { data: userPage } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const existing = userPage?.users?.find((u) => normalizeEmail(u.email) === emailNorm)
      if (!existing?.id) {
        return NextResponse.json(
          { error: 'A client with this email already has an account' },
          { status: 400 }
        )
      }
      const { data: existingProfile } = await service
        .from('profiles')
        .select('role')
        .eq('id', existing.id)
        .maybeSingle()
      if (existingProfile?.role === 'coach') {
        return NextResponse.json(
          { error: 'This email is already used by a coach account' },
          { status: 400 }
        )
      }
      const { error: updErr } = await service.auth.admin.updateUserById(existing.id, {
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          role: 'client',
          workspace_id: workspaceId,
          must_change_password: true,
        },
      })
      if (updErr) {
        return NextResponse.json(
          { error: updErr.message || 'Could not reset client account' },
          { status: 500 }
        )
      }
      newUserId = existing.id
    } else {
      newUserId = createdAuth.user.id
      createdNewAuthUser = true
    }
    const fullName = `${firstName} ${lastName}`.trim()

    const { error: profileErr } = await service.from('profiles').upsert(
      {
        id: newUserId,
        email: emailNorm,
        full_name: fullName,
        role: 'client',
        workspace_id: workspaceId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

    if (profileErr) {
      if (createdNewAuthUser) {
        await service.auth.admin.deleteUser(newUserId)
      }
      return NextResponse.json(
        { error: profileErr.message || 'Could not create client profile' },
        { status: 500 }
      )
    }

    const { data, error } = await supabase
      .from('clients')
      .insert({
        coach_id: user.id,
        workspace_id: workspaceId,
        first_name: firstName,
        last_name: lastName,
        email: emailNorm,
        phone: phone?.trim() || null,
        goals: goals?.trim() || null,
        status: 'active',
      })
      .select('id, first_name, last_name, email, status, created_at')
      .single()

    if (error) {
      if (createdNewAuthUser) {
        await service.auth.admin.deleteUser(newUserId)
      }
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A client with this email already exists' }, { status: 400 })
      }
      return NextResponse.json(
        { error: error.message || 'Could not create client' },
        { status: 500 }
      )
    }
    return NextResponse.json({ data: { client: data, tempPassword } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
