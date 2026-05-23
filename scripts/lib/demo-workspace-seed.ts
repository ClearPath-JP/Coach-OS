/**
 * Shared demo content: clients, availability, sessions, programs, packages, payments, messages.
 * Used by seed-demo-data.ts and scripts/setup.ts (optional demo flag).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, addMinutes, set } from 'date-fns'

export const DEMO_COACH_EMAIL = 'demo@clearpath.com'

export const DEMO_SEED_CLIENT_EMAILS = ['sarah@demo.com', 'marcus@demo.com', 'emma@demo.com', 'james@demo.com', 'olivia@demo.com'] as const

type ClientSeed = {
  firstName: string
  lastName: string
  email: string
  goals: string
  notes: string
  status: 'active'
  daysActive: number
}

type ProgramModuleSeed = {
  key: string
  title: string
  blocks: { type: 'text' | 'url'; title?: string; body?: string; url?: string }[]
}

const CLIENTS: ClientSeed[] = [
  {
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah@demo.com',
    status: 'active',
    goals: 'Lose 20lbs, build sustainable strength habits',
    notes: 'Very motivated. Responds well to data and tracking. Prefers morning sessions.',
    daysActive: 45,
  },
  {
    firstName: 'Marcus',
    lastName: 'Williams',
    email: 'marcus@demo.com',
    status: 'active',
    goals: 'Improve athletic performance, increase vertical jump',
    notes: 'Former college athlete. Highly competitive. Needs accountability.',
    daysActive: 38,
  },
  {
    firstName: 'Emma',
    lastName: 'Chen',
    email: 'emma@demo.com',
    status: 'active',
    goals: 'Reduce stress, find work-life balance, build energy',
    notes: 'Tech executive. Very busy schedule. Needs flexible approach.',
    daysActive: 22,
  },
  {
    firstName: 'James',
    lastName: 'Rodriguez',
    email: 'james@demo.com',
    status: 'active',
    goals: 'Build muscle mass, improve nutrition habits',
    notes: 'Beginner. Needs detailed guidance. Very consistent.',
    daysActive: 60,
  },
  {
    firstName: 'Olivia',
    lastName: 'Thompson',
    email: 'olivia@demo.com',
    status: 'active',
    goals: 'Complete first marathon, build endurance base',
    notes: 'Runner background. Motivated by milestones and progress tracking.',
    daysActive: 15,
  },
]

const now = new Date()

function dayAgoAt(daysAgo: number, hour: number, minute: number): Date {
  return set(addDays(now, -daysAgo), { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 })
}

function dayAheadAt(daysAhead: number, hour: number, minute: number): Date {
  return set(addDays(now, daysAhead), { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 })
}

async function createProgram(
  admin: SupabaseClient,
  workspaceId: string,
  coachUserId: string,
  title: string,
  modules: ProgramModuleSeed[]
): Promise<{ programId: string; moduleIdsByKey: Record<string, string> }> {
  const { data: program, error: pErr } = await admin
    .from('programs')
    .insert({
      coach_id: coachUserId,
      workspace_id: workspaceId,
      title,
      status: 'published',
      total_modules: modules.length,
    })
    .select('id')
    .single()
  if (pErr || !program?.id) throw new Error(pErr?.message ?? `Could not create program ${title}`)

  const moduleIdsByKey: Record<string, string> = {}
  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i]!
    const { data: moduleRow, error: mErr } = await admin
      .from('program_modules')
      .insert({
        program_id: program.id,
        workspace_id: workspaceId,
        title: mod.title,
        position: i,
      })
      .select('id')
      .single()
    if (mErr || !moduleRow?.id) throw new Error(mErr?.message ?? `Could not create module ${mod.title}`)

    moduleIdsByKey[mod.key] = moduleRow.id

    for (let b = 0; b < mod.blocks.length; b++) {
      const block = mod.blocks[b]!
      const { error: cErr } = await admin.from('program_content').insert({
        module_id: moduleRow.id,
        workspace_id: workspaceId,
        content_type: block.type,
        title: block.title ?? null,
        body: block.body ?? null,
        url: block.url ?? null,
        position: b,
      })
      if (cErr) throw new Error(cErr.message)
    }
  }

  return { programId: program.id, moduleIdsByKey }
}

export async function seedDemoWorkspaceContent(admin: SupabaseClient, workspaceId: string, coachUserId: string): Promise<void> {
  const clientIdsByEmail: Record<string, string> = {}
  const clientAuthIdsByEmail: Record<string, string> = {}

  for (const client of CLIENTS) {
    let clientProfileId: string

    const { data: authUser, error: uErr } = await admin.auth.admin.createUser({
      email: client.email.toLowerCase(),
      password: 'Demo1234!',
      email_confirm: true,
      user_metadata: { role: 'client', workspace_id: workspaceId },
    })
    if (uErr) {
      // User already exists — look them up instead
      const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const existing = users.users.find((u) => u.email?.toLowerCase() === client.email.toLowerCase())
      if (!existing?.id) throw new Error(`Could not find or create user for ${client.email}`)
      clientProfileId = existing.id
    } else if (!authUser.user?.id) {
      throw new Error(`Auth failed for ${client.email}`)
    } else {
      clientProfileId = authUser.user.id
    }

    clientAuthIdsByEmail[client.email.toLowerCase()] = clientProfileId

    const fullName = `${client.firstName} ${client.lastName}`
    const createdAt = dayAgoAt(client.daysActive, 8, 0).toISOString()

    const { error: profileErr } = await admin.from('profiles').upsert(
      {
        id: clientProfileId,
        email: client.email.toLowerCase(),
        full_name: fullName,
        role: 'client',
        workspace_id: workspaceId,
        created_at: createdAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    if (profileErr) throw new Error(profileErr.message)

    const { data: clientRow, error: clErr } = await admin
      .from('clients')
      .insert({
        coach_id: coachUserId,
        workspace_id: workspaceId,
        first_name: client.firstName,
        last_name: client.lastName,
        email: client.email.toLowerCase(),
        goals: client.goals,
        notes: client.notes,
        status: client.status,
        created_at: createdAt,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (clErr || !clientRow?.id) throw new Error(clErr?.message ?? `Could not create client ${client.email}`)
    clientIdsByEmail[client.email.toLowerCase()] = clientRow.id
  }

  for (let dow = 1; dow <= 5; dow++) {
    const { error } = await admin.from('recurring_availability').insert({
      workspace_id: workspaceId,
      coach_id: coachUserId,
      day_of_week: dow,
      start_time: '09:00:00',
      end_time: '17:00:00',
      label: 'Coaching hours',
      is_active: true,
    })
    if (error) throw new Error(error.message)
  }
  const { error: saturdayAvailabilityErr } = await admin.from('recurring_availability').insert({
    workspace_id: workspaceId,
    coach_id: coachUserId,
    day_of_week: 6,
    start_time: '09:00:00',
    end_time: '12:00:00',
    label: 'Coaching hours',
    is_active: true,
  })
  if (saturdayAvailabilityErr) throw new Error(saturdayAvailabilityErr.message)

  const sarahId = clientIdsByEmail['sarah@demo.com']!
  const marcusId = clientIdsByEmail['marcus@demo.com']!
  const emmaId = clientIdsByEmail['emma@demo.com']!
  const jamesId = clientIdsByEmail['james@demo.com']!
  const oliviaId = clientIdsByEmail['olivia@demo.com']!

  const sessions: {
    clientId: string
    start: Date
    duration: number
    mode: 'video' | 'phone'
    status: 'completed' | 'confirmed' | 'cancelled'
  }[] = [
    { clientId: sarahId, start: dayAgoAt(29, 9, 0), duration: 60, mode: 'video', status: 'completed' },
    { clientId: sarahId, start: dayAgoAt(23, 11, 0), duration: 60, mode: 'video', status: 'completed' },
    { clientId: sarahId, start: dayAgoAt(14, 14, 0), duration: 60, mode: 'video', status: 'completed' },
    { clientId: sarahId, start: dayAgoAt(6, 10, 0), duration: 60, mode: 'video', status: 'completed' },
    { clientId: marcusId, start: dayAgoAt(27, 13, 0), duration: 60, mode: 'video', status: 'completed' },
    { clientId: marcusId, start: dayAgoAt(19, 15, 0), duration: 90, mode: 'phone', status: 'completed' },
    { clientId: marcusId, start: dayAgoAt(12, 9, 30), duration: 60, mode: 'video', status: 'completed' },
    { clientId: marcusId, start: dayAgoAt(4, 16, 0), duration: 90, mode: 'phone', status: 'completed' },
    { clientId: emmaId, start: dayAgoAt(20, 9, 0), duration: 45, mode: 'video', status: 'completed' },
    { clientId: emmaId, start: dayAgoAt(10, 9, 30), duration: 45, mode: 'video', status: 'completed' },
    { clientId: emmaId, start: dayAgoAt(3, 10, 0), duration: 45, mode: 'video', status: 'completed' },
    { clientId: jamesId, start: dayAgoAt(18, 12, 0), duration: 60, mode: 'video', status: 'completed' },
    { clientId: jamesId, start: dayAgoAt(8, 13, 30), duration: 60, mode: 'video', status: 'completed' },
    { clientId: oliviaId, start: dayAgoAt(11, 11, 0), duration: 30, mode: 'phone', status: 'completed' },
    { clientId: sarahId, start: dayAheadAt(1, 10, 0), duration: 60, mode: 'video', status: 'confirmed' },
    { clientId: marcusId, start: dayAheadAt(3, 14, 0), duration: 60, mode: 'video', status: 'confirmed' },
    { clientId: emmaId, start: dayAheadAt(5, 9, 0), duration: 45, mode: 'video', status: 'confirmed' },
    { clientId: oliviaId, start: dayAheadAt(7, 11, 0), duration: 30, mode: 'phone', status: 'confirmed' },
    { clientId: jamesId, start: dayAgoAt(10, 15, 0), duration: 60, mode: 'video', status: 'cancelled' },
    { clientId: oliviaId, start: dayAgoAt(20, 10, 30), duration: 30, mode: 'phone', status: 'cancelled' },
  ]

  for (const session of sessions) {
    const { error } = await admin.from('sessions').insert({
      coach_id: coachUserId,
      client_id: session.clientId,
      workspace_id: workspaceId,
      scheduled_time: session.start.toISOString(),
      end_time: addMinutes(session.start, session.duration).toISOString(),
      duration_minutes: session.duration,
      status: session.status,
      notes: `${session.mode === 'video' ? 'Video call' : 'Phone call'} session`,
    })
    if (error) throw new Error(error.message)
  }

  const programOne = await createProgram(admin, workspaceId, coachUserId, '12-Week Body Transformation', [
    { key: 'p1m1', title: 'Getting Started', blocks: [{ type: 'text', body: 'Welcome and program overview' }, { type: 'url', title: 'Introduction', url: 'https://youtube.com' }] },
    { key: 'p1m2', title: 'Week 1-3: Building Your Foundation', blocks: [{ type: 'text', body: 'Foundation phase overview' }, { type: 'url', title: 'Nutrition basics', url: 'https://examine.com' }] },
    { key: 'p1m3', title: 'Week 4-6: Increasing Intensity', blocks: [{ type: 'text', body: 'Progression principles' }] },
    { key: 'p1m4', title: 'Week 7-9: Peak Training Phase', blocks: [{ type: 'text', body: 'Peak phase guidance' }] },
    { key: 'p1m5', title: 'Week 10-12: Final Push', blocks: [{ type: 'text', body: 'Championship mindset' }] },
    { key: 'p1m6', title: 'Recovery and Maintenance', blocks: [{ type: 'text', body: 'Recovery planning and deload structure.' }] },
    { key: 'p1m7', title: 'Habits for Longevity', blocks: [{ type: 'text', body: 'Keeping momentum after the transformation phase.' }] },
    { key: 'p1m8', title: 'Performance Analytics', blocks: [{ type: 'text', body: 'Measure trends and adjust programming with data.' }] },
    { key: 'p1m9', title: 'Advanced Technique', blocks: [{ type: 'text', body: 'Technique refinement for compound lifts and intervals.' }] },
    { key: 'p1m10', title: 'Graduate Level', blocks: [{ type: 'text', body: 'Graduation roadmap and continued accountability system.' }] },
  ])

  const programTwo = await createProgram(admin, workspaceId, coachUserId, 'Mindset Reset: 4-Week Program', [
    { key: 'p2m1', title: 'Understanding Your Patterns', blocks: [{ type: 'text', body: 'Awareness exercises' }] },
    { key: 'p2m2', title: 'Rewiring Limiting Beliefs', blocks: [{ type: 'text', body: 'Cognitive reframing tools' }] },
    { key: 'p2m3', title: 'Building New Neural Pathways', blocks: [{ type: 'text', body: 'Daily practice guide' }] },
    { key: 'p2m4', title: 'Sustaining Your New Mindset', blocks: [{ type: 'text', body: 'Long-term strategy' }] },
  ])

  const programThree = await createProgram(admin, workspaceId, coachUserId, 'Nutrition Foundations', [
    { key: 'p3m1', title: 'Understanding Macros', blocks: [{ type: 'text', body: 'Macro explanation' }, { type: 'url', title: 'Macro calculator', url: 'https://examine.com' }] },
    { key: 'p3m2', title: 'Building Your Meal Plan', blocks: [{ type: 'text', body: 'Meal planning system' }] },
    { key: 'p3m3', title: 'Grocery Shopping Guide', blocks: [{ type: 'text', body: 'Shopping strategies' }] },
    { key: 'p3m4', title: 'Meal Prep Mastery', blocks: [{ type: 'text', body: 'Prep system' }] },
  ])

  const { data: clientPrograms, error: cpErr } = await admin
    .from('client_programs')
    .insert([
      { workspace_id: workspaceId, program_id: programOne.programId, client_id: sarahId, assigned_by: coachUserId, status: 'active', started_at: dayAgoAt(29, 9, 0).toISOString() },
      { workspace_id: workspaceId, program_id: programOne.programId, client_id: marcusId, assigned_by: coachUserId, status: 'active', started_at: dayAgoAt(25, 9, 0).toISOString() },
      { workspace_id: workspaceId, program_id: programTwo.programId, client_id: emmaId, assigned_by: coachUserId, status: 'active', started_at: dayAgoAt(20, 9, 0).toISOString() },
      { workspace_id: workspaceId, program_id: programTwo.programId, client_id: oliviaId, assigned_by: coachUserId, status: 'active', started_at: dayAgoAt(13, 9, 0).toISOString() },
      { workspace_id: workspaceId, program_id: programThree.programId, client_id: jamesId, assigned_by: coachUserId, status: 'active', started_at: dayAgoAt(30, 9, 0).toISOString() },
    ])
    .select('id, client_id, program_id')
  if (cpErr || !clientPrograms) throw new Error(cpErr?.message ?? 'Could not create client program assignments')

  const cpByClientProgram: Record<string, string> = {}
  for (const row of clientPrograms) cpByClientProgram[`${row.client_id}:${row.program_id}`] = row.id

  const progressRows = [
    // Program 1 completions
    { clientId: sarahId, programId: programOne.programId, moduleKeys: ['p1m1', 'p1m2', 'p1m3', 'p1m4', 'p1m5', 'p1m6'] },
    { clientId: marcusId, programId: programOne.programId, moduleKeys: ['p1m1', 'p1m2', 'p1m3'] },
    // Program 2 completions
    { clientId: emmaId, programId: programTwo.programId, moduleKeys: ['p2m1', 'p2m2'] },
    { clientId: oliviaId, programId: programTwo.programId, moduleKeys: ['p2m1'] },
    // Program 3 completions
    { clientId: jamesId, programId: programThree.programId, moduleKeys: ['p3m1', 'p3m2'] },
  ]

  for (const progress of progressRows) {
    const clientProgramId = cpByClientProgram[`${progress.clientId}:${progress.programId}`]
    if (!clientProgramId) throw new Error('Missing client_program row for progress seed')

    for (let i = 0; i < progress.moduleKeys.length; i++) {
      const moduleKey = progress.moduleKeys[i]!
      const moduleId =
        programOne.moduleIdsByKey[moduleKey] ?? programTwo.moduleIdsByKey[moduleKey] ?? programThree.moduleIdsByKey[moduleKey]
      if (!moduleId) throw new Error(`Missing module id for ${moduleKey}`)

      const { error } = await admin.from('program_progress').insert({
        workspace_id: workspaceId,
        client_program_id: clientProgramId,
        module_id: moduleId,
        client_id: progress.clientId,
        completed_at: dayAgoAt(8 + i, 18, 0).toISOString(),
      })
      if (error) throw new Error(error.message)
    }
  }

  const packageDefs = [
    { title: 'Discovery Call', price_cents: 9700, duration_minutes: 30, session_type: 'video' },
    { title: 'Monthly Coaching', price_cents: 49700, duration_minutes: 60, session_type: 'video' },
    { title: 'VIP Intensive', price_cents: 99700, duration_minutes: 90, session_type: 'in_person' },
    { title: 'Group Session', price_cents: 19700, duration_minutes: 60, session_type: 'video' },
  ] as const

  const packageIdsByTitle: Record<string, string> = {}
  for (const pkg of packageDefs) {
    const { data, error } = await admin
      .from('session_packages')
      .insert({
        workspace_id: workspaceId,
        coach_id: coachUserId,
        title: pkg.title,
        price_cents: pkg.price_cents,
        duration_minutes: pkg.duration_minutes,
        session_type: pkg.session_type,
        is_active: true,
      })
      .select('id')
      .single()
    if (error || !data?.id) throw new Error(error?.message ?? `Could not create package ${pkg.title}`)
    packageIdsByTitle[pkg.title] = data.id
  }

  const paymentRows: {
    clientId: string
    amountCents: number
    paymentMethod: 'cash' | 'venmo' | 'cashapp' | 'zelle' | 'bank_transfer'
    dayOffset: number
    reference?: string
    notes?: string
  }[] = [
    { clientId: sarahId, amountCents: 49700, paymentMethod: 'venmo', dayOffset: 28, reference: 'V-8821-sarah' },
    { clientId: marcusId, amountCents: 49700, paymentMethod: 'cashapp', dayOffset: 26, reference: 'CA-3341-marcus' },
    { clientId: jamesId, amountCents: 19700, paymentMethod: 'zelle', dayOffset: 24, reference: 'ZL-9981' },
    { clientId: emmaId, amountCents: 9700, paymentMethod: 'cash', dayOffset: 20, notes: 'Discovery call payment' },
    { clientId: sarahId, amountCents: 99700, paymentMethod: 'venmo', dayOffset: 18, reference: 'V-8834-sarah' },
    { clientId: oliviaId, amountCents: 9700, paymentMethod: 'cashapp', dayOffset: 16, reference: 'CA-3355' },
    { clientId: marcusId, amountCents: 19700, paymentMethod: 'venmo', dayOffset: 13, reference: 'V-8847' },
    { clientId: jamesId, amountCents: 49700, paymentMethod: 'zelle', dayOffset: 12, reference: 'ZL-9994' },
    { clientId: emmaId, amountCents: 49700, paymentMethod: 'venmo', dayOffset: 10, reference: 'V-8851-emma' },
    { clientId: sarahId, amountCents: 19700, paymentMethod: 'cashapp', dayOffset: 9, reference: 'CA-3368' },
    { clientId: oliviaId, amountCents: 49700, paymentMethod: 'venmo', dayOffset: 7, reference: 'V-8862' },
    { clientId: marcusId, amountCents: 99700, paymentMethod: 'bank_transfer', dayOffset: 6, reference: 'BT-wire-marcus' },
    { clientId: emmaId, amountCents: 19700, paymentMethod: 'cash', dayOffset: 5, notes: 'Group session' },
    { clientId: jamesId, amountCents: 9700, paymentMethod: 'cashapp', dayOffset: 4, reference: 'CA-3379' },
    { clientId: sarahId, amountCents: 49700, paymentMethod: 'zelle', dayOffset: 2, reference: 'ZL-0012-sarah' },
  ]

  for (const payment of paymentRows) {
    const { error } = await admin.from('payments').insert({
      coach_id: coachUserId,
      client_id: payment.clientId,
      workspace_id: workspaceId,
      amount_cents: payment.amountCents,
      currency: 'usd',
      payment_method: payment.paymentMethod,
      payment_reference: payment.reference ?? null,
      notes: payment.notes ?? null,
      payment_date: dayAgoAt(payment.dayOffset, 12, 0).toISOString().slice(0, 10),
    })
    if (error) throw new Error(error.message)
  }

  const invoiceRows = [
    { clientId: sarahId, packageTitle: 'Monthly Coaching', amountCents: 49700, daysAgo: 3 },
    { clientId: marcusId, packageTitle: 'Group Session', amountCents: 19700, daysAgo: 1 },
    { clientId: emmaId, packageTitle: 'Discovery Call', amountCents: 9700, daysAgo: 0 },
    { clientId: oliviaId, packageTitle: 'Monthly Coaching', amountCents: 49700, daysAgo: 5 },
  ]

  for (const invoice of invoiceRows) {
    const packageId = packageIdsByTitle[invoice.packageTitle]
    if (!packageId) throw new Error(`Missing package for invoice: ${invoice.packageTitle}`)

    const createdAt = dayAgoAt(invoice.daysAgo, 10, 0).toISOString()
    const { error } = await admin.from('session_invoices').insert({
      workspace_id: workspaceId,
      package_id: packageId,
      coach_id: coachUserId,
      client_id: invoice.clientId,
      amount_cents: invoice.amountCents,
      currency: 'usd',
      status: 'pending',
      created_at: createdAt,
      updated_at: createdAt,
      due_date: dayAheadAt(7, 10, 0).toISOString(),
    })
    if (error) throw new Error(error.message)
  }

  const messageThreads: Record<string, { dayOffset: number; sender: 'coach' | 'client'; content: string }[]> = {
    'sarah@demo.com': [
      { dayOffset: 28, sender: 'coach', content: 'Hi Sarah! Welcome to Peak Performance. How are you feeling about starting your journey?' },
      { dayOffset: 28, sender: 'client', content: 'So excited to get started! A little nervous but ready to commit.' },
      { dayOffset: 27, sender: 'coach', content: "That nervous energy is perfect fuel. I've reviewed your goals and I have a great plan for you." },
      { dayOffset: 21, sender: 'client', content: 'Just finished my first week of workouts. Harder than expected but I feel amazing!' },
      { dayOffset: 21, sender: 'coach', content: "That soreness means it's working! How did the nutrition tracking go this week?" },
      { dayOffset: 14, sender: 'client', content: "Down 3lbs! The meal plan is actually sustainable unlike diets I've tried before." },
      { dayOffset: 14, sender: 'coach', content: "3lbs in 2 weeks is perfect sustainable progress. Let's talk strategy for the weekend." },
      { dayOffset: 7, sender: 'client', content: 'Had a rough week - missed two workouts. Feeling guilty.' },
      { dayOffset: 7, sender: 'coach', content: "Progress isn't linear. You missed 2 out of 14 workouts - that's an 86% success rate. Be kind to yourself." },
      { dayOffset: 1, sender: 'client', content: 'That reframe helped so much. Back on track and feeling strong again!' },
    ],
    'marcus@demo.com': [
      { dayOffset: 25, sender: 'coach', content: "Marcus, I've designed a periodization plan based on your athletic background. Ready to push?" },
      { dayOffset: 25, sender: 'client', content: "Born ready. Let's do this coach." },
      { dayOffset: 18, sender: 'client', content: 'Vertical is up 2 inches already. This program is no joke.' },
      { dayOffset: 18, sender: 'coach', content: "That's massive progress in 3 weeks. Your explosive training is paying off." },
      { dayOffset: 11, sender: 'coach', content: "How's recovery feeling? Important to not overtrain this phase." },
      { dayOffset: 11, sender: 'client', content: "Honestly a bit tired but I don't want to slow down." },
      { dayOffset: 7, sender: 'coach', content: 'Trust the process. Recovery IS the training. Taking your rest days seriously?' },
      { dayOffset: 3, sender: 'client', content: 'You were right. Took 2 full rest days and feel incredible.' },
    ],
    'emma@demo.com': [
      { dayOffset: 20, sender: 'coach', content: "Emma, given your schedule I've built a 30-minute morning routine that will transform your energy levels." },
      { dayOffset: 20, sender: 'client', content: "30 minutes I can do. Anything longer and I can't commit." },
      { dayOffset: 15, sender: 'client', content: 'Week 1 done. I actually look forward to mornings now which is WILD for me.' },
      { dayOffset: 15, sender: 'coach', content: 'That shift is everything. How is stress feeling at work?' },
      { dayOffset: 10, sender: 'client', content: 'Noticeably better. My team even commented that I seem different.' },
      { dayOffset: 10, sender: 'coach', content: "That's the compound effect of consistency. You're building a new identity." },
      { dayOffset: 5, sender: 'client', content: 'Can we add a second session per week? I want more.' },
      { dayOffset: 5, sender: 'coach', content: "Love the energy! Let's add Wednesday evenings. 6pm work?" },
      { dayOffset: 2, sender: 'client', content: 'Perfect. See you Wednesday.' },
    ],
    'james@demo.com': [
      { dayOffset: 55, sender: 'coach', content: 'James, starting from scratch is actually an advantage. No bad habits to unlearn.' },
      { dayOffset: 55, sender: 'client', content: 'Good because I have literally never lifted weights before.' },
      { dayOffset: 45, sender: 'client', content: 'I did my first full workout without stopping. Felt like a victory.' },
      { dayOffset: 45, sender: 'coach', content: 'It IS a victory. Celebrate every win.' },
      { dayOffset: 30, sender: 'client', content: 'Up 4lbs on the scale. Is that muscle or fat?' },
      { dayOffset: 30, sender: 'coach', content: 'At your stage it is mostly muscle and water. Your clothes fitting differently tells the real story.' },
      { dayOffset: 15, sender: 'client', content: 'My pants are loose. You were right.' },
      { dayOffset: 5, sender: 'coach', content: 'Body recomposition happening in real time. How is nutrition tracking?' },
    ],
    'olivia@demo.com': [
      { dayOffset: 13, sender: 'coach', content: "Olivia, your marathon base is stronger than you think. Let's build systematically." },
      { dayOffset: 13, sender: 'client', content: 'I just want to finish. Sub-4 hours would be a dream.' },
      { dayOffset: 10, sender: 'coach', content: "Sub-4 is very achievable with your current fitness. Here's the 12-week plan." },
      { dayOffset: 10, sender: 'client', content: 'This plan looks incredible. Starting Monday.' },
      { dayOffset: 7, sender: 'client', content: 'Week 1 done. 35 miles total. Legs are tired but good tired.' },
      { dayOffset: 7, sender: 'coach', content: 'Perfect week. How is sleep and nutrition supporting the training load?' },
      { dayOffset: 4, sender: 'client', content: 'Added the protein targets. Already recovering faster.' },
      { dayOffset: 2, sender: 'coach', content: 'Great adaptation. Week 2 brings some tempo work. Ready to push the pace?' },
    ],
  }

  for (const client of CLIENTS) {
    const email = client.email.toLowerCase()
    const clientId = clientIdsByEmail[email]
    const profileId = clientAuthIdsByEmail[email]
    const thread = messageThreads[email]
    if (!clientId || !profileId || !thread) throw new Error(`Missing message links for ${email}`)

    for (let i = 0; i < thread.length; i++) {
      const msg = thread[i]!
      const sender = msg.sender === 'coach' ? coachUserId : profileId
      const recipient = msg.sender === 'coach' ? profileId : coachUserId
      const createdAt = dayAgoAt(msg.dayOffset, 9, i * 6).toISOString()

      const { error } = await admin.from('messages').insert({
        workspace_id: workspaceId,
        sender_id: sender,
        recipient_id: recipient,
        client_id: clientId,
        content: msg.content,
        created_at: createdAt,
      })
      if (error) throw new Error(error.message)
    }
  }
}
