/**
 * WARNING: Only run on a development or demo Supabase project. Never on production.
 *
 * Seeds a full demo workspace (coach, clients, sessions, programs, packages, payments, messages).
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 *
 * Run: pnpm run seed:demo
 */

import { config as loadEnv } from 'dotenv'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { seedDemoWorkspaceContent } from './lib/demo-workspace-seed'

loadEnv({ path: resolve(process.cwd(), '.env.local') })

const DEMO_COACH = {
  email: 'demo@clearpath.com',
  password: 'Demo1234!',
  firstName: 'Alex',
  lastName: 'Rivera',
  workspaceName: 'Peak Performance Coaching',
  brandName: 'Peak Performance Coaching',
  brandTagline: 'Transform your performance',
  accentColor: '#2D7A6F',
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

  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existingDemo = list?.users?.find((u) => u.email?.toLowerCase() === DEMO_COACH.email.toLowerCase())
  if (existingDemo) {
    console.log('Demo coach already exists — delete demo users/workspace first or use a fresh project. Exiting.')
    process.exit(0)
  }

  const { data: createdCoach, error: coachAuthErr } = await admin.auth.admin.createUser({
    email: DEMO_COACH.email.toLowerCase(),
    password: DEMO_COACH.password,
    email_confirm: true,
    user_metadata: { full_name: DEMO_COACH.firstName },
  })
  if (coachAuthErr || !createdCoach.user?.id) {
    console.error(coachAuthErr?.message ?? 'Could not create demo coach')
    process.exit(1)
  }
  const coachUserId = createdCoach.user.id

  const { data: workspace, error: wsErr } = await admin
    .from('workspaces')
    .insert({
      name: DEMO_COACH.workspaceName,
      owner_id: coachUserId,
      accent_color: DEMO_COACH.accentColor,
      brand_name: DEMO_COACH.brandName,
      brand_tagline: DEMO_COACH.brandTagline,
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
      email: DEMO_COACH.email.toLowerCase(),
      full_name: `${DEMO_COACH.firstName} ${DEMO_COACH.lastName}`,
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

  try {
    await seedDemoWorkspaceContent(admin, workspaceId, coachUserId)
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  }

  async function countRows(table: string): Promise<number> {
    const { count, error } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
    if (error) {
      throw new Error(`Could not count ${table}: ${error.message}`)
    }
    return count ?? 0
  }

  const [coachCount, clientCount, sessionCount, messageCount, programCount, moduleCount, contentCount, packageCount, paymentCount, invoiceCount] =
    await Promise.all([
      countRows('coaches'),
      countRows('clients'),
      countRows('sessions'),
      countRows('messages'),
      countRows('programs'),
      countRows('program_modules'),
      countRows('program_content'),
      countRows('session_packages'),
      countRows('payments'),
      countRows('session_invoices'),
    ])

  console.log('Demo data seeded successfully.')
  console.log(`Coach: ${DEMO_COACH.email} / ${DEMO_COACH.password}`)
  console.log('Clients: sarah@demo.com, marcus@demo.com, emma@demo.com, james@demo.com, olivia@demo.com (password Demo1234!)')
  console.log('Created counts:')
  console.log(`- Coach accounts: ${coachCount}`)
  console.log(`- Clients: ${clientCount}`)
  console.log(`- Sessions: ${sessionCount}`)
  console.log(`- Messages: ${messageCount}`)
  console.log(`- Programs: ${programCount}`)
  console.log(`- Modules: ${moduleCount}`)
  console.log(`- Content blocks: ${contentCount}`)
  console.log(`- Packages: ${packageCount}`)
  console.log(`- Payments: ${paymentCount}`)
  console.log(`- Invoices: ${invoiceCount}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
