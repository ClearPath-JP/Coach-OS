/**
 * Aligns the Supabase auth user + profile for the single hardcoded admin (ADMIN_EMAIL).
 * Access to /admin is enforced by ADMIN_EMAIL in the app — this script sets DB flags for RLS / tooling only.
 *
 * Prereq: Either
 *   A) Sign up at /signup (or Supabase Dashboard) with the same email as ADMIN_EMAIL, then run this script, or
 *   B) Set ADMIN_BOOTSTRAP_PASSWORD (≥8 chars) in .env.local — script will create the Auth user if missing (dev/bootstrap only).
 *
 * Run from repo root: pnpm run setup:admin
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadProjectDotenv } from './load-dotenv'

loadProjectDotenv(import.meta.url)

const DEFAULT_ADMIN = 'jpotesta15@outlook.com'
const MIN_PASSWORD_LEN = 8

function exitSoon(code: number): void {
  process.exitCode = code
  // Avoid libuv "UV_HANDLE_CLOSING" assertion on Windows when tsx exits right after Supabase client I/O
  setTimeout(() => process.exit(code), 50)
}

async function findAuthUserIdByEmail(supabase: SupabaseClient, email: string): Promise<string | null> {
  const perPage = 1000
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message)
    const hit = data.users.find((u) => u.email?.toLowerCase() === email)
    if (hit?.id) return hit.id
    if (!data.users.length || data.users.length < perPage) break
  }
  return null
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    exitSoon(1)
    return
  }

  const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN).trim().toLowerCase()
  if (!ADMIN_EMAIL.includes('@')) {
    console.error('Invalid ADMIN_EMAIL')
    exitSoon(1)
    return
  }

  console.log('Setting up admin account…')
  console.log(`Target email (must match Auth user): ${ADMIN_EMAIL}`)
  console.log('(Set ADMIN_EMAIL in .env.local if this is not the account you created.)\n')

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  let userId = await findAuthUserIdByEmail(supabase, ADMIN_EMAIL)

  if (!userId) {
    const bootstrapPassword =
      process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim() ||
      process.env.CLEARPATH_ADMIN_PASSWORD?.trim() ||
      ''

    if (bootstrapPassword.length >= MIN_PASSWORD_LEN) {
      console.log('No Auth user found — creating one (bootstrap password from env)…')
      const created = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: bootstrapPassword,
        email_confirm: true,
        user_metadata: { full_name: 'ClearPath Admin' },
      })
      if (created.error || !created.data.user?.id) {
        console.error(created.error?.message ?? 'Could not create admin auth user')
        exitSoon(1)
        return
      }
      userId = created.data.user.id
      console.log('Created Supabase Auth user for admin.\n')
    } else {
      console.error('No Auth user exists for that email.')
      console.error('')
      console.error('Fix one of the following:')
      console.error(`  1) Sign up at /signup with email: ${ADMIN_EMAIL}`)
      console.error('  2) Or change ADMIN_EMAIL in .env.local to match the email you already use in Supabase Auth')
      console.error(
        `  3) Or set ADMIN_BOOTSTRAP_PASSWORD (≥${MIN_PASSWORD_LEN} chars) in .env.local and run again to auto-create the user`
      )
      console.error('')
      exitSoon(1)
      return
    }
  }

  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email: ADMIN_EMAIL,
      is_super_admin: true,
      role: 'coach',
      full_name: 'ClearPath Admin',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  if (error) {
    console.error('Error:', error.message)
    exitSoon(1)
    return
  }

  console.log('✓ Admin account configured')
  console.log('✓ Login:', ADMIN_EMAIL)
  console.log('✓ After login you will be redirected to /admin/overview')
  exitSoon(0)
}

main().catch((err) => {
  console.error(err)
  exitSoon(1)
})
