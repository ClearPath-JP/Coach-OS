/**
 * Creates a single test client linked to the demo coach workspace.
 *
 * Prerequisites: coach exists (e.g. pnpm run create:demo → coach@example.com).
 *
 * Env (optional):
 *   CLEARPATH_TEST_COACH_EMAIL   default coach@example.com
 *   CLEARPATH_TEST_CLIENT_EMAIL  default client@example.com
 *   CLEARPATH_TEST_CLIENT_PASSWORD  default ClientDemo123!
 *
 * Run: pnpm run seed:test-client
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadProjectDotenv } from './load-dotenv'

loadProjectDotenv(import.meta.url)

const COACH_EMAIL = (process.env.CLEARPATH_TEST_COACH_EMAIL ?? 'coach@example.com').trim().toLowerCase()
const CLIENT_EMAIL = (process.env.CLEARPATH_TEST_CLIENT_EMAIL ?? 'client@example.com').trim().toLowerCase()
const CLIENT_PASSWORD = process.env.CLEARPATH_TEST_CLIENT_PASSWORD ?? 'ClientDemo123!'

async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  let page = 1
  const perPage = 1000
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message)
    const hit = data.users.find((u) => u.email?.toLowerCase() === email)
    if (hit?.id) return hit.id
    if (!data.users.length || data.users.length < perPage) break
    page += 1
  }
  return null
}

async function main() {
  if (CLIENT_PASSWORD.length < 8) {
    console.error('CLEARPATH_TEST_CLIENT_PASSWORD must be at least 8 characters.')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const coachUserId = await findUserIdByEmail(admin, COACH_EMAIL)
  if (!coachUserId) {
    console.error(`No coach auth user found for ${COACH_EMAIL}. Run: pnpm run create:demo`)
    process.exit(1)
  }

  const { data: coachRow, error: coachErr } = await admin
    .from('coaches')
    .select('workspace_id')
    .eq('user_id', coachUserId)
    .maybeSingle()
  if (coachErr || !coachRow?.workspace_id) {
    console.error('Coach has no workspace row. Run: pnpm run create:demo')
    process.exit(1)
  }
  const workspaceId = coachRow.workspace_id

  const existingClientUid = await findUserIdByEmail(admin, CLIENT_EMAIL)
  if (existingClientUid) {
    await admin.from('clients').delete().eq('email', CLIENT_EMAIL).eq('workspace_id', workspaceId)
    const { error: delErr } = await admin.auth.admin.deleteUser(existingClientUid)
    if (delErr) console.warn('Could not remove old client auth user:', delErr.message)
  }

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: CLIENT_EMAIL,
    password: CLIENT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      role: 'client',
      workspace_id: workspaceId,
    },
  })
  if (authErr || !created.user?.id) {
    console.error(authErr?.message ?? 'Could not create client auth user')
    process.exit(1)
  }
  const clientUserId = created.user.id

  const { error: profErr } = await admin.from('profiles').upsert(
    {
      id: clientUserId,
      email: CLIENT_EMAIL,
      full_name: 'Test Client',
      role: 'client',
      workspace_id: workspaceId,
      is_super_admin: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
  if (profErr) {
    await admin.auth.admin.deleteUser(clientUserId)
    console.error(profErr.message)
    process.exit(1)
  }

  const { error: insErr } = await admin.from('clients').insert({
    coach_id: coachUserId,
    workspace_id: workspaceId,
    first_name: 'Test',
    last_name: 'Client',
    email: CLIENT_EMAIL,
    status: 'active',
  })
  if (insErr) {
    await admin.auth.admin.deleteUser(clientUserId)
    console.error(insErr.message)
    process.exit(1)
  }

  console.log('')
  console.log('Test client ready:')
  console.log(`  Email:    ${CLIENT_EMAIL}`)
  console.log(`  Password: ${CLIENT_PASSWORD}`)
  console.log('  Use /client-login or /login (intent client) if your app supports it.')
  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
