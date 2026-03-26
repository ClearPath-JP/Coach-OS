import { createClient } from '@supabase/supabase-js'
import {
  BASE_URL,
  CLIENT_EMAIL,
  CLIENT_PASSWORD,
  COACH_EMAIL,
  COACH_PASSWORD,
  sessionCookiesFromPassword,
} from '../setup'

/**
 * Ensures test coach auth user exists (confirmed) and workspace + coach rows exist.
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_* in .env.local.
 */
export async function ensureCoachAuthAndWorkspace(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required in .env.local for API tests'
    )
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const email = COACH_EMAIL.toLowerCase()
  const { data: page } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  let userId = page?.users?.find((u) => u.email?.toLowerCase() === email)?.id ?? null

  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: COACH_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Test' },
    })
    if (error) throw new Error(error.message)
    userId = created.user?.id ?? null
  } else {
    await admin.auth.admin.updateUserById(userId, {
      password: COACH_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Test' },
    })
  }

  if (!userId) throw new Error('Could not resolve coach user id')

  const { data: coachRow } = await admin
    .from('coaches')
    .select('id, workspace_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (coachRow?.workspace_id) {
    await admin
      .from('profiles')
      .update({ workspace_id: coachRow.workspace_id, updated_at: new Date().toISOString() })
      .eq('id', userId)
    return
  }

  const jar = await sessionCookiesFromPassword(COACH_EMAIL, COACH_PASSWORD)
  const complete = await fetch(`${BASE_URL}/api/auth/signup-complete`, {
    method: 'POST',
    headers: { Cookie: jar },
  })

  if (!complete.ok) {
    const { data: again } = await admin
      .from('coaches')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
    if (again) return
    const t = await complete.text()
    throw new Error(`signup-complete failed: ${complete.status} ${t}`)
  }
}

/**
 * Ensures an auth user + profiles row exist for the test client email (same workspace as coach).
 * Call after POST /api/clients so the clients row exists. Idempotent.
 */
export async function ensureTestClientAuth(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required')
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: page } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const coachEmail = COACH_EMAIL.toLowerCase()
  const clientEmail = CLIENT_EMAIL.toLowerCase()

  const coachUser = page?.users?.find((u) => u.email?.toLowerCase() === coachEmail)
  if (!coachUser?.id) throw new Error('Coach auth user not found for ensureTestClientAuth')

  const { data: coachRow, error: coachErr } = await admin
    .from('coaches')
    .select('workspace_id')
    .eq('user_id', coachUser.id)
    .single()
  if (coachErr || !coachRow?.workspace_id) {
    throw new Error(coachErr?.message ?? 'Coach workspace not found')
  }

  let clientUid = page?.users?.find((u) => u.email?.toLowerCase() === clientEmail)?.id ?? null

  if (!clientUid) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: clientEmail,
      password: CLIENT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: 'client',
        workspace_id: coachRow.workspace_id,
      },
    })
    if (error) throw new Error(error.message)
    clientUid = created.user?.id ?? null
  } else {
    await admin.auth.admin.updateUserById(clientUid, {
      password: CLIENT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: 'client',
        workspace_id: coachRow.workspace_id,
      },
    })
  }

  if (!clientUid) throw new Error('Could not resolve client auth user id')

  const { data: authUser } = await admin.auth.admin.getUserById(clientUid)
  const emailFromAuth = (authUser.user?.email ?? clientEmail).trim().toLowerCase()

  const { error: profErr } = await admin.from('profiles').upsert(
    {
      id: clientUid,
      email: emailFromAuth,
      full_name: 'Test Client',
      role: 'client',
      workspace_id: coachRow.workspace_id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
  if (profErr) throw new Error(profErr.message)

  const { data: clientRow } = await admin
    .from('clients')
    .select('id, email')
    .eq('workspace_id', coachRow.workspace_id)
    .eq('email', clientEmail)
    .maybeSingle()
  if (clientRow?.id && clientRow.email !== emailFromAuth) {
    await admin.from('clients').update({ email: emailFromAuth }).eq('id', clientRow.id)
  }
}

/**
 * Deletes clients in the default test coach workspace whose email matches a prefix.
 * Frees plan slots for repeated UI flow tests (service role).
 */
export async function deleteTestClientsByEmailPrefix(prefix: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: page } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const coachUser = page?.users?.find((u) => u.email?.toLowerCase() === COACH_EMAIL.toLowerCase())
  if (!coachUser?.id) return
  const { data: coachRow } = await admin
    .from('coaches')
    .select('workspace_id')
    .eq('user_id', coachUser.id)
    .maybeSingle()
  if (!coachRow?.workspace_id) return

  await admin
    .from('clients')
    .delete()
    .eq('workspace_id', coachRow.workspace_id)
    .ilike('email', `${prefix}%`)
}

/** Removes the test client row so coach can re-add under plan limits (service role). */
export async function deleteTestClientRowForEmail(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  await admin.from('clients').delete().eq('email', CLIENT_EMAIL.toLowerCase())
}
