/**
 * DESTRUCTIVE — wipes every workspace + auth user EXCEPT the admin.
 *
 * Required env (set in .env.local OR pass inline):
 *   ADMIN_EMAIL=jp@example.com
 *   CLEARPATH_WIPE_EXCEPT_ADMIN_CONFIRM=YES
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Run from COACH-OS root:
 *   npm run wipe:except-admin
 *
 * Inline one-shot (Bash):
 *   CLEARPATH_WIPE_EXCEPT_ADMIN_CONFIRM=YES ADMIN_EMAIL=jp@example.com npm run wipe:except-admin
 *
 * Preserves:
 *   - Admin's auth.users row
 *   - Admin's profile row (with is_super_admin flag)
 *   - Any workspace owned by admin (keeps their test data intact)
 *
 * Deletes:
 *   - All other workspaces (CASCADE removes coaches, clients, programs, sessions, videos, etc.)
 *   - All other auth users
 *
 * Does NOT clear Supabase Storage buckets (video uploads) — delete manually in dashboard if needed.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { loadProjectDotenv } from './load-dotenv'

// Support a custom env file via DOTENV_PATH; fallback to .env.local via helper.
if (process.env.DOTENV_PATH) {
  // override: false so shell env vars take precedence over the file
  loadEnv({ path: process.env.DOTENV_PATH, override: false })
} else {
  loadProjectDotenv(import.meta.url)
}

const REQUIRED_CONFIRM = 'YES'

async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string
): Promise<string | null> {
  const perPage = 1000
  const needle = email.toLowerCase()
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`List users: ${error.message}`)
    const hit = data.users.find((u) => u.email?.toLowerCase() === needle)
    if (hit?.id) return hit.id
    if (!data.users.length || data.users.length < perPage) break
  }
  return null
}

async function main(): Promise<void> {
  const confirm = process.env.CLEARPATH_WIPE_EXCEPT_ADMIN_CONFIRM?.trim()
  if (confirm !== REQUIRED_CONFIRM) {
    console.error(
      [
        'Refusing to wipe. Set this env var then run again:',
        `  CLEARPATH_WIPE_EXCEPT_ADMIN_CONFIRM=${REQUIRED_CONFIRM}`,
        '',
        'Also required: ADMIN_EMAIL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY',
      ].join('\n')
    )
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()

  if (!url?.trim() || !key?.trim()) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  if (!adminEmail) {
    console.error('ADMIN_EMAIL is required — set it in .env.local or pass inline')
    process.exit(1)
  }

  console.log(`Supabase: ${url}`)
  console.log(`Preserving admin: ${adminEmail}`)

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const adminId = await findUserIdByEmail(admin, adminEmail)
  if (!adminId) {
    console.error(
      `No auth user exists for ${adminEmail}. Refusing to wipe — admin must exist first.`
    )
    process.exit(1)
  }
  console.log(`Admin auth user id: ${adminId}\n`)

  // Count before (for visibility)
  const { data: allWorkspaces, error: wsErr } = await admin
    .from('workspaces')
    .select('id, owner_id, name')
  if (wsErr) throw new Error(`List workspaces: ${wsErr.message}`)

  const adminWorkspaces = (allWorkspaces ?? []).filter((w) => w.owner_id === adminId)
  const toDeleteWorkspaces = (allWorkspaces ?? []).filter((w) => w.owner_id !== adminId)

  console.log(
    `Workspaces: ${allWorkspaces?.length ?? 0} total — will keep ${adminWorkspaces.length} (admin's), delete ${toDeleteWorkspaces.length} others`
  )

  for (const ws of toDeleteWorkspaces) {
    const { error } = await admin.from('workspaces').delete().eq('id', ws.id)
    if (error) {
      console.error(`  Failed: ${ws.name} (${ws.id}) — ${error.message}`)
    } else {
      console.log(`  Deleted workspace: ${ws.name} (${ws.id})`)
    }
  }

  // Delete auth users (except admin)
  console.log('\nDeleting auth users…')
  let page = 1
  const perPage = 1000
  let userDeleted = 0
  let userSkipped = 0
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`List users: ${error.message}`)
    const users = data.users
    if (!users.length) break
    for (const u of users) {
      if (u.id === adminId) {
        console.log(`  Skip admin: ${u.email ?? u.id}`)
        userSkipped += 1
        continue
      }
      const { error: delErr } = await admin.auth.admin.deleteUser(u.id)
      if (delErr) {
        console.error(`  Failed: ${u.email ?? u.id} — ${delErr.message}`)
      } else {
        console.log(`  Deleted: ${u.email ?? u.id}`)
        userDeleted += 1
      }
    }
    if (users.length < perPage) break
    page += 1
  }

  console.log('')
  console.log('===== SUMMARY =====')
  console.log(`Workspaces deleted: ${toDeleteWorkspaces.length}`)
  console.log(`Workspaces preserved (admin): ${adminWorkspaces.length}`)
  console.log(`Auth users deleted: ${userDeleted}`)
  console.log(`Auth users preserved (admin): ${userSkipped}`)
  console.log('===================')
  console.log(`\nAdmin can now log in at /login with: ${adminEmail}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
