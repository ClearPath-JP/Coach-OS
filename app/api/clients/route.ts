import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { requireCoach } from '@/lib/api-helpers'
import { addClientSchema } from '@/lib/validations'
import { checkClientLimit } from '@/lib/plan-limits'
import { calculateEngagementScore } from '@/lib/client-engagement'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { normalizeEmail, sanitizeIlikeSearch } from '@/lib/utils'

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function generateTempPassword(): string {
  const bytes = randomBytes(12)
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += ALPHANUMERIC[(bytes[i] as number) % ALPHANUMERIC.length]
  }
  return password
}

const CLIENTS_DEFAULT_LIMIT = 500
const CLIENTS_MAX_LIMIT = 500

/**
 * GET /api/clients — clients for the coach's workspace (paginated).
 * Query: ?search= ?status= ?limit= (default 500, max 500) ?offset=
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
    const limit = Math.min(
      CLIENTS_MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get('limit') ?? String(CLIENTS_DEFAULT_LIMIT), 10) || CLIENTS_DEFAULT_LIMIT)
    )
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0)
    const rangeEnd = offset + limit - 1

    let query = supabase
      .from('clients')
      .select('id, workspace_id, first_name, last_name, email, phone, goals, status, notes, profile_photo_url, created_at, updated_at', {
        count: 'exact',
      })
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .range(offset, rangeEnd)

    if (status && ['active', 'paused', 'completed'].includes(status)) {
      query = query.eq('status', status)
    }
    if (safeSearch) {
      query = query.or(
        `first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`
      )
    }

    const { data, error, count } = await query

    if (error) {
      console.error('GET /api/clients', error)
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 }
      )
    }
    const list = data ?? []
    const ids = list.map((c) => c.id)
    let merged = list
    if (ids.length > 0) {
      const { data: rewardRows } = await supabase
        .from('client_rewards')
        .select(
          'client_id, total_xp, level, current_streak_days, last_activity_at, assignments_completed, assignments_total'
        )
        .eq('workspace_id', workspaceId)
        .in('client_id', ids)
      const rmap = new Map((rewardRows ?? []).map((r) => [r.client_id, r]))

      const { data: sessionRows } = await supabase
        .from('sessions')
        .select('client_id, status')
        .eq('workspace_id', workspaceId)
        .in('client_id', ids)

      const completedCountByClient = new Map<string, number>()
      for (const id of ids) {
        completedCountByClient.set(id, 0)
      }
      for (const row of sessionRows ?? []) {
        if (row.status !== 'completed') continue
        const cid = row.client_id as string
        completedCountByClient.set(cid, (completedCountByClient.get(cid) ?? 0) + 1)
      }

      const { data: programRows } = await supabase
        .from('client_programs')
        .select('id, client_id, created_at, programs ( title, total_modules )')
        .eq('workspace_id', workspaceId)
        .in('client_id', ids)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      type ActiveProg = { clientProgramId: string; title: string; totalModules: number }
      const activeProgramByClient = new Map<string, ActiveProg>()
      for (const row of programRows ?? []) {
        const cid = row.client_id as string
        if (activeProgramByClient.has(cid)) continue
        const raw = row.programs as
          | { title?: string | null; total_modules?: number | null }
          | { title?: string | null; total_modules?: number | null }[]
          | null
        const p = Array.isArray(raw) ? raw[0] : raw
        const title = p?.title?.trim()
        if (!title) continue
        activeProgramByClient.set(cid, {
          clientProgramId: row.id as string,
          title,
          totalModules: Math.max(0, p?.total_modules ?? 0),
        })
      }

      const clientProgramIds = [...activeProgramByClient.values()].map((v) => v.clientProgramId)
      const modulesCompletedByCp = new Map<string, number>()
      if (clientProgramIds.length > 0) {
        const { data: progressRows } = await supabase
          .from('program_progress')
          .select('client_program_id')
          .eq('workspace_id', workspaceId)
          .in('client_program_id', clientProgramIds)
          .not('completed_at', 'is', null)
        for (const pr of progressRows ?? []) {
          const cpid = pr.client_program_id as string
          modulesCompletedByCp.set(cpid, (modulesCompletedByCp.get(cpid) ?? 0) + 1)
        }
      }

      merged = list.map((c) => {
        const n = completedCountByClient.get(c.id) ?? 0
        const rw = rmap.get(c.id)
        const engagement = calculateEngagementScore({
          last_activity_at: rw?.last_activity_at ?? null,
          assignments_completed: rw?.assignments_completed ?? 0,
          assignments_total: rw?.assignments_total ?? 0,
          streak_days: rw?.current_streak_days ?? 0,
        })
        const ap = activeProgramByClient.get(c.id)
        const modulesCompleted = ap ? (modulesCompletedByCp.get(ap.clientProgramId) ?? 0) : 0
        const totalModules = ap?.totalModules ?? 0
        const programProgress =
          ap && totalModules > 0 ? Math.round((modulesCompleted / totalModules) * 100) : 0
        return {
          ...c,
          rewards: rw ?? null,
          lastActivityAt: rw?.last_activity_at ?? null,
          sessionsCompletedCount: n,
          activeProgramTitle: ap?.title ?? null,
          modulesCompleted,
          totalModules,
          programProgress,
          engagement,
        }
      })
    }
    const total = count ?? merged.length
    const res = NextResponse.json({
      data: merged,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + merged.length < total,
      },
    })
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
        { error: 'A client with this email already exists in your workspace.' },
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
        console.error('POST /api/clients createUser', authErr)
        return NextResponse.json(
          { error: 'Could not create client account. Please try again.' },
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
        console.error('POST /api/clients updateUserById', updErr)
        return NextResponse.json(
          { error: 'Could not create client account. Please try again.' },
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
      console.error('POST /api/clients profile upsert', profileErr)
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
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
        return NextResponse.json(
          { error: 'A client with this email already exists in your workspace.' },
          { status: 400 }
        )
      }
      console.error('POST /api/clients insert', error)
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
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
