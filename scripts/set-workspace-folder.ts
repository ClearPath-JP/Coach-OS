/**
 * Sets a workspace's google_drive_import_folder_id by coach email.
 * Bypasses the coach settings UI — useful for setup/debugging.
 *
 * Usage:
 *   COACH_EMAIL=coach@example.com FOLDER_ID=abc123 npx tsx scripts/set-workspace-folder.ts
 *
 * With a custom env file:
 *   DOTENV_PATH=.env.peek COACH_EMAIL=... FOLDER_ID=... npx tsx scripts/set-workspace-folder.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'
import { loadProjectDotenv } from './load-dotenv'

if (process.env.DOTENV_PATH) {
  loadEnv({ path: process.env.DOTENV_PATH, override: false })
} else {
  loadProjectDotenv(import.meta.url)
}

async function main(): Promise<void> {
  const email = process.env.COACH_EMAIL?.trim().toLowerCase()
  const folderId = process.env.FOLDER_ID?.trim()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  if (!email || !folderId) {
    console.error('COACH_EMAIL and FOLDER_ID are required')
    process.exit(1)
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const user = users.users.find((u) => u.email?.toLowerCase() === email)
  if (!user) {
    console.error(`No auth user for ${email}`)
    process.exit(1)
  }

  const { data: coach } = await admin
    .from('coaches')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!coach?.workspace_id) {
    console.error(`No workspace for ${email}`)
    process.exit(1)
  }

  const { error } = await admin
    .from('workspaces')
    .update({ google_drive_import_folder_id: folderId })
    .eq('id', coach.workspace_id)

  if (error) {
    console.error('Failed:', error.message)
    process.exit(1)
  }

  console.log(`Saved folder ID ${folderId} on workspace ${coach.workspace_id} (${email})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
