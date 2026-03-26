/**
 * Removes the demo@clearpath.com workspace and all related auth users
 * (demo coach + seeded @demo.com clients).
 *
 * Run: pnpm run reset:demo
 */

import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DEMO_COACH_EMAIL, DEMO_SEED_CLIENT_EMAILS } from './lib/demo-workspace-seed'

loadEnv({ path: resolve(process.cwd(), '.env.local') })

async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  let page = 1
  const perPage = 1000
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message)
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (hit?.id) return hit.id
    if (!data.users.length || data.users.length < perPage) break
    page += 1
  }
  return null
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const coachId = await findUserIdByEmail(admin, DEMO_COACH_EMAIL)
  if (!coachId) {
    console.log('No demo coach found — nothing to remove.')
    process.exit(0)
  }

  const { data: coachRow } = await admin
    .from('coaches')
    .select('workspace_id')
    .eq('user_id', coachId)
    .maybeSingle()

  const workspaceId = coachRow?.workspace_id ?? null
  if (workspaceId) {
    const { error: delWs } = await admin.from('workspaces').delete().eq('id', workspaceId)
    if (delWs) {
      console.error('Could not delete workspace:', delWs.message)
      process.exit(1)
    }
    console.log('Deleted demo workspace and related data.')
  }

  for (const email of [...DEMO_SEED_CLIENT_EMAILS]) {
    const uid = await findUserIdByEmail(admin, email)
    if (uid) {
      const { error } = await admin.auth.admin.deleteUser(uid)
      if (error) {
        console.error(`Could not delete ${email}:`, error.message)
        process.exit(1)
      }
      console.log(`Removed user ${email}`)
    }
  }

  const { error: delCoach } = await admin.auth.admin.deleteUser(coachId)
  if (delCoach) {
    console.error('Could not delete demo coach:', delCoach.message)
    process.exit(1)
  }
  console.log(`Removed demo coach ${DEMO_COACH_EMAIL}`)
  console.log('Demo reset complete.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
