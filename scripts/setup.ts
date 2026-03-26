/**
 * Interactive first-time setup for a new coach installation.
 * Run: corepack pnpm run setup
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { config as loadEnv } from 'dotenv'
import readline from 'readline'
import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { seedDemoWorkspaceContent } from './lib/demo-workspace-seed'

loadEnv({ path: resolve(process.cwd(), '.env.local') })

const DEFAULT_ACCENT = '#2D7A6F'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = randomBytes(16)
  const core = Array.from(bytes, (b) => chars[b % chars.length]).join('')
  return `${core}!9`
}

function expandHex3(h: string): string {
  if (h.length === 3) {
    return h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!
  }
  return h
}

function parseAccent(input: string): string | null {
  const t = input.trim()
  if (!t) return DEFAULT_ACCENT
  const withHash = t.startsWith('#') ? t : `#${t}`
  if (!/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(withHash)) return null
  const hex = withHash.slice(1)
  return `#${expandHex3(hex)}`.toUpperCase()
}

function createRl() {
  return readline.createInterface({ input: process.stdin, output: process.stdout })
}

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => rl.question(prompt, resolve))
}

async function main() {
  const rl = createRl()
  let businessName: string
  let firstName: string
  let email: string
  let accentColor: string
  let addDemo: boolean

  try {
    businessName = (await question(rl, 'What is your coaching business name? ')).trim()
    if (!businessName) {
      console.error('Business name is required.')
      process.exit(1)
    }
    firstName = (await question(rl, 'What is your first name? ')).trim()
    if (!firstName) {
      console.error('First name is required.')
      process.exit(1)
    }
    email = (await question(rl, 'What is your email address? ')).trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error('A valid email is required.')
      process.exit(1)
    }

    const accentRaw = await question(
      rl,
      'Choose an accent color (press enter for default teal #2D7A6F): '
    )
    const parsedAccent = parseAccent(accentRaw)
    if (!parsedAccent) {
      console.error('Invalid hex color. Use #RGB or #RRGGBB.')
      process.exit(1)
    }
    accentColor = parsedAccent

    const demoAns = (await question(
      rl,
      'Add demo data? Realistic clients, sessions, and payments will be added so the app looks populated. (y/n) '
    ))
      .trim()
      .toLowerCase()
    addDemo = demoAns === 'y' || demoAns === 'yes'
  } finally {
    rl.close()
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('\n[1/6] Checking database connection...')
  const { error: pingErr } = await admin.from('workspaces').select('id').limit(1)
  if (pingErr) {
    console.error('Could not reach Supabase:', pingErr.message)
    process.exit(1)
  }

  console.log('[2/6] Running database migrations...')
  const push = spawnSync('npx', ['supabase', 'db', 'push'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
  })
  if (push.status !== 0) {
    console.error(
      '\nMigration step failed. Ensure the Supabase CLI is linked (`npx supabase link --project-ref …`) and try again, or run `pnpm run db:push` manually.'
    )
    process.exit(1)
  }

  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === email)
  if (existing) {
    console.error(`An account already exists for ${email}. Use a different email or remove the user in Supabase first.`)
    process.exit(1)
  }

  const tempPassword = generateTempPassword()

  console.log('[3/6] Creating your coach account...')
  console.log(`      Email: ${email}`)
  console.log(`      Temp password: ${tempPassword}`)

  const { data: createdCoach, error: coachAuthErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: firstName },
  })
  if (coachAuthErr || !createdCoach.user?.id) {
    console.error(coachAuthErr?.message ?? 'Could not create coach account')
    process.exit(1)
  }
  const coachUserId = createdCoach.user.id

  console.log('[4/6] Setting up your workspace...')
  const { data: workspace, error: wsErr } = await admin
    .from('workspaces')
    .insert({
      name: businessName,
      owner_id: coachUserId,
      accent_color: accentColor,
      brand_name: businessName,
      completed_onboarding: true,
    })
    .select('id')
    .single()
  if (wsErr || !workspace?.id) {
    console.error(wsErr?.message ?? 'Could not create workspace')
    process.exit(1)
  }
  const workspaceId = workspace.id

  const { error: profErr } = await admin.from('profiles').upsert(
    {
      id: coachUserId,
      email,
      full_name: firstName,
      role: 'coach',
      workspace_id: workspaceId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
  if (profErr) {
    console.error(profErr.message)
    process.exit(1)
  }

  const { error: coachRowErr } = await admin.from('coaches').insert({
    user_id: coachUserId,
    workspace_id: workspaceId,
    role: 'owner',
  })
  if (coachRowErr) {
    console.error(coachRowErr.message)
    process.exit(1)
  }

  if (addDemo) {
    console.log('[5/6] Adding demo data...')
    try {
      await seedDemoWorkspaceContent(admin, workspaceId, coachUserId)
    } catch (e) {
      console.error(e instanceof Error ? e.message : e)
      process.exit(1)
    }
  } else {
    console.log('[5/6] Skipping demo data.')
  }

  console.log('[6/6] Setup complete!\n')
  console.log('============================================')
  console.log('ClearPath Coach OS — Setup Complete')
  console.log('============================================')
  console.log(`Login URL:    http://localhost:3000/login`)
  console.log(`Email:        ${email}`)
  console.log(`Password:     ${tempPassword}`)
  console.log('')
  console.log('Next steps:')
  console.log('1. Open the login URL above')
  console.log('2. Sign in with your credentials')
  console.log('3. Go to Settings to customize your brand')
  console.log('4. Add your first real client')
  console.log('5. Before going live, update your .env.local')
  console.log('   with production Supabase and Stripe keys')
  console.log('')
  console.log('Need help? docs.clearpath.com')
  console.log('============================================\n')

  if (addDemo) {
    console.log(
      'Demo clients use @demo.com addresses and password Demo1234!. Remove with: pnpm run reset:demo\n'
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
