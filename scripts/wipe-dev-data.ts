/**
 * DEV / STAGING ONLY — irreversible.
 *
 * Deletes every workspace (CASCADE removes most app data), then deletes every Auth user
 * (profiles and other user-linked rows cascade).
 *
 * Set in .env.local exactly:
 *   CLEARPATH_DEV_WIPE_CONFIRM=DELETE_ALL_APP_DATA
 *
 * Run: pnpm run wipe:dev
 *
 * Does not clear Storage buckets (video files, uploads). Clean those in Dashboard if needed.
 * Never run against production.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadProjectDotenv } from './load-dotenv'

loadProjectDotenv(import.meta.url)

const REQUIRED_CONFIRM = 'DELETE_ALL_APP_DATA'

async function deleteAllWorkspaces(admin: SupabaseClient): Promise<void> {
  const { data: rows, error } = await admin.from('workspaces').select('id')
  if (error) throw new Error(`List workspaces: ${error.message}`)
  for (const row of rows ?? []) {
    const { error: delErr } = await admin.from('workspaces').delete().eq('id', row.id)
    if (delErr) throw new Error(`Delete workspace ${row.id}: ${delErr.message}`)
  }
  console.log(`Removed ${rows?.length ?? 0} workspace(s).`)
}

async function deleteAllAuthUsers(admin: SupabaseClient): Promise<void> {
  let page = 1
  const perPage = 1000
  let total = 0
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`List users: ${error.message}`)
    const users = data.users
    if (!users.length) break
    for (const u of users) {
      const { error: delErr } = await admin.auth.admin.deleteUser(u.id)
      if (delErr) {
        console.error(`Could not delete auth user ${u.email ?? u.id}: ${delErr.message}`)
      } else {
        total += 1
        console.log(`Removed auth user: ${u.email ?? u.id}`)
      }
    }
    if (users.length < perPage) break
    page += 1
  }
  console.log(`Removed ${total} auth user(s).`)
}

async function main() {
  const confirm = process.env.CLEARPATH_DEV_WIPE_CONFIRM?.trim()
  if (confirm !== REQUIRED_CONFIRM) {
    console.error(
      [
        'Refusing to wipe: set this in .env.local then run again:',
        `  CLEARPATH_DEV_WIPE_CONFIRM=${REQUIRED_CONFIRM}`,
        '',
        'This deletes ALL workspaces and ALL Auth users for this Supabase project.',
      ].join('\n')
    )
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

  console.log('Wiping workspaces…')
  await deleteAllWorkspaces(admin)
  console.log('Wiping auth users…')
  await deleteAllAuthUsers(admin)
  console.log('')
  console.log('Done. Next:')
  console.log('  1. pnpm run setup:admin     (CLEARPATH_ADMIN_EMAIL / PASSWORD — use a dedicated admin email)')
  console.log('  2. pnpm run create:demo     (coach@example.com / Demo123!)')
  console.log('  3. pnpm run seed:test-client')
  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
