import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { seedDemoWorkspaceContent } from './lib/demo-workspace-seed'
import { loadProjectDotenv } from './load-dotenv'

if (process.env.DOTENV_PATH) {
  loadEnv({ path: process.env.DOTENV_PATH, override: false })
} else {
  loadProjectDotenv(import.meta.url)
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env variables')

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const email = 'coach@example.com'
  const password = 'Demo123!'
  const firstName = 'Alex'
  const lastName = 'Rivera'
  const workspaceName = 'Peak Performance Coaching'

  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = users.users.find((u) => u.email?.toLowerCase() === email)

  let userId = existing?.id
  if (!userId) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `${firstName} ${lastName}` },
    })
    if (created.error || !created.data.user?.id) throw new Error(created.error?.message ?? 'Could not create user')
    userId = created.data.user.id
  } else {
    await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: `${firstName} ${lastName}` },
    })
  }

  if (!userId) throw new Error('Could not resolve coach user id')

  let workspaceId: string | null = null
  const { data: coachExisting } = await admin
    .from('coaches')
    .select('workspace_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (coachExisting?.workspace_id) {
    workspaceId = coachExisting.workspace_id
  }
  if (!workspaceId) {
    const { data: owned } = await admin.from('workspaces').select('id').eq('owner_id', userId).maybeSingle()
    if (owned?.id) workspaceId = owned.id
  }
  if (!workspaceId) {
    const wsRes = await admin
      .from('workspaces')
      .insert({
        name: workspaceName,
        owner_id: userId,
        brand_name: workspaceName,
        accent_color: '#3B9EE8',
        completed_onboarding: true,
      })
      .select('id')
      .single()
    workspaceId = wsRes.data?.id ?? null
    if (!workspaceId) throw new Error(wsRes.error?.message ?? 'Could not create workspace')
  }

  await admin.from('profiles').upsert(
    {
      id: userId,
      email,
      full_name: `${firstName} ${lastName}`,
      role: 'coach',
      workspace_id: workspaceId,
      is_super_admin: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  const coachRow = await admin.from('coaches').select('id').eq('user_id', userId).maybeSingle()
  if (!coachRow.data) {
    await admin.from('coaches').insert({ user_id: userId, workspace_id: workspaceId, role: 'owner' })
  }

  const sub = await admin.from('subscriptions').select('workspace_id').eq('workspace_id', workspaceId).maybeSingle()
  if (!sub.data) {
    await admin.from('subscriptions').insert({
      workspace_id: workspaceId,
      plan: 'starter',
      status: 'active',
    })
  }

  await seedDemoWorkspaceContent(admin, workspaceId, userId)

  console.log(`Demo coach ready: ${email} / ${password}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
