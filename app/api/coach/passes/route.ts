import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { createClassPassSchema } from '@/lib/validations'

// class_passes columns aren't in generated Supabase types yet.
interface ClassPass {
  id: string
  workspace_id: string
  coach_id: string
  title: string
  description: string | null
  price_cents: number
  currency: string
  credit_count: number
  applies_to: string
  applies_to_types: string[] | null
  expires_in_days: number | null
  status: string
  created_at: string
  updated_at: string
}

interface ClientPassRow {
  pass_id: string
  client_id: string
  credits_remaining: number
}

/** GET /api/coach/passes — the workspace's passes + how many credits are outstanding. */
export async function GET() {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`passes-get:${user.id}`, {
      windowMs: 60_000,
      max: 120,
    })
    if (!success) {
      const res = NextResponse.json({ error: 'Too many requests — try again in a minute' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const svc = createServiceClient()
    const { data: rawPasses, error: passesErr } = await svc
      .from('class_passes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (passesErr) {
      console.error('GET /api/coach/passes — passes query', passesErr)
      return NextResponse.json({ error: 'Could not load passes' }, { status: 500 })
    }

    const passes = (rawPasses ?? []) as unknown as ClassPass[]
    if (passes.length === 0) {
      return NextResponse.json({ data: { passes: [], holderTotal: 0, creditsOutstanding: 0 } })
    }

    const { data: rawHeld, error: heldErr } = await svc
      .from('client_passes')
      .select('pass_id, client_id, credits_remaining')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .gt('credits_remaining', 0)

    if (heldErr) {
      console.error('GET /api/coach/passes — held query', heldErr)
      return NextResponse.json({ error: 'Could not load pass balances' }, { status: 500 })
    }

    const held = (rawHeld ?? []) as unknown as ClientPassRow[]
    const holdersByPass = new Map<string, Set<string>>()
    const creditsByPass = new Map<string, number>()
    for (const h of held) {
      if (!holdersByPass.has(h.pass_id)) holdersByPass.set(h.pass_id, new Set())
      holdersByPass.get(h.pass_id)!.add(h.client_id)
      creditsByPass.set(h.pass_id, (creditsByPass.get(h.pass_id) ?? 0) + (h.credits_remaining ?? 0))
    }

    let holderTotal = 0
    let creditsOutstanding = 0
    const enriched = passes.map((p) => {
      const holders = holdersByPass.get(p.id)?.size ?? 0
      const credits = creditsByPass.get(p.id) ?? 0
      holderTotal += holders
      creditsOutstanding += credits
      return { ...p, holders, creditsOutstanding: credits }
    })

    return NextResponse.json({ data: { passes: enriched, holderTotal, creditsOutstanding } })
  } catch (e) {
    console.error('GET /api/coach/passes', e)
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}

/** POST /api/coach/passes — create a class-credit pass. */
export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`passes-post:${user.id}`, {
      windowMs: 60_000,
      max: 30,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again in a minute' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json()
    const parsed = createClassPassSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
    }
    const d = parsed.data

    const svc = createServiceClient()
    const { data: rawRow, error: insertErr } = await svc
      .from('class_passes')
      .insert({
        workspace_id: workspaceId,
        coach_id: user.id,
        title: d.title,
        description: d.description ?? null,
        price_cents: d.priceCents,
        currency: d.currency,
        credit_count: d.creditCount,
        applies_to: d.appliesTo,
        applies_to_types: d.appliesToTypes ?? null,
        expires_in_days: d.expiresInDays ?? null,
        status: d.status,
      })
      .select('*')
      .single()

    if (insertErr || !rawRow) {
      console.error('POST /api/coach/passes — insert', insertErr)
      return NextResponse.json({ error: 'Could not create pass' }, { status: 500 })
    }

    return NextResponse.json({ data: { ...(rawRow as unknown as ClassPass), holders: 0, creditsOutstanding: 0 } }, { status: 201 })
  } catch (e) {
    console.error('POST /api/coach/passes', e)
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}
