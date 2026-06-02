import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { stripe } from '@/lib/stripe'
import { createMembershipPlanSchema } from '@/lib/validations'

// ---------------------------------------------------------------------------
// Types — membership_plans columns are not yet in generated Supabase types.
// ---------------------------------------------------------------------------

interface MembershipPlan {
  id: string
  workspace_id: string
  coach_id: string
  name: string
  price_cents: number
  currency: string
  interval: string
  access_type: string
  classes_per_period: number | null
  applies_to: string
  applies_to_types: string[] | null
  stripe_product_id: string | null
  stripe_price_id: string | null
  status: string
  created_at: string
  updated_at: string
}

interface ClientMembershipCountRow {
  plan_id: string
  count: number
}

// ---------------------------------------------------------------------------
// GET /api/coach/memberships
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success, retryAfter } = await checkRateLimitAsync(
      `memberships-get:${user.id}`,
      { windowMs: 60_000, max: 120 }
    )
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many requests — try again in a minute' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const svc = createServiceClient()

    // Fetch all plans for this workspace, newest first.
    const { data: rawPlans, error: plansErr } = await svc
      .from('membership_plans')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (plansErr) {
      console.error('GET /api/coach/memberships — plans query', plansErr)
      return NextResponse.json({ error: 'Could not load membership plans' }, { status: 500 })
    }

    const plans = (rawPlans ?? []) as unknown as MembershipPlan[]

    if (plans.length === 0) {
      return NextResponse.json({ data: { plans: [], mrrCents: 0, memberTotal: 0 } })
    }

    const planIds = plans.map((p) => p.id)

    // Count active client_memberships per plan.
    // status in ('active','trialing','past_due')
    const { data: rawCounts, error: countErr } = await svc
      .from('client_memberships')
      .select('plan_id')
      .eq('workspace_id', workspaceId)
      .in('status', ['active', 'trialing', 'past_due'])
      .in('plan_id', planIds)

    if (countErr) {
      console.error('GET /api/coach/memberships — counts query', countErr)
      return NextResponse.json({ error: 'Could not load member counts' }, { status: 500 })
    }

    // Aggregate counts in memory (avoids needing a DB aggregate function on a
    // table whose types aren't in generated typings yet).
    const countMap = new Map<string, number>()
    for (const row of (rawCounts ?? []) as unknown as ClientMembershipCountRow[]) {
      const pid = (row as unknown as { plan_id: string }).plan_id
      countMap.set(pid, (countMap.get(pid) ?? 0) + 1)
    }

    let mrrCents = 0
    let memberTotal = 0

    const enriched = plans.map((plan) => {
      const memberCount = countMap.get(plan.id) ?? 0
      memberTotal += memberCount
      // Only active plans contribute to MRR (draft/archived don't have live subs).
      if (plan.status === 'active') {
        mrrCents += plan.price_cents * memberCount
      }
      return { ...plan, memberCount }
    })

    return NextResponse.json({ data: { plans: enriched, mrrCents, memberTotal } })
  } catch (e) {
    console.error('GET /api/coach/memberships', e)
    return NextResponse.json(
      { error: 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/coach/memberships
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(
      `memberships-post:${user.id}`,
      { windowMs: 60_000, max: 30 }
    )
    if (!rateOk) {
      const res = NextResponse.json(
        { error: 'Too many requests — try again in a minute' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json()
    const parsed = createMembershipPlanSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const {
      name,
      priceCents,
      currency,
      accessType,
      classesPerPeriod,
      appliesTo,
      appliesToTypes,
      status,
    } = parsed.data

    // Stripe Product + Price — only for non-draft plans.
    let stripeProductId: string | null = null
    let stripePriceId: string | null = null

    if (status !== 'draft') {
      if (!stripe) {
        return NextResponse.json(
          { error: 'Stripe is not configured on this server — create the plan as a draft first' },
          { status: 503 }
        )
      }

      const product = await stripe.products.create({
        name,
        metadata: { workspace_id: workspaceId },
      })
      stripeProductId = product.id

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: priceCents,
        currency,
        recurring: { interval: 'month' },
      })
      stripePriceId = price.id
    }

    const svc = createServiceClient()

    const { data: rawRow, error: insertErr } = await svc
      .from('membership_plans')
      .insert({
        workspace_id: workspaceId,
        coach_id: user.id,
        name,
        price_cents: priceCents,
        currency,
        interval: 'month',
        access_type: accessType,
        classes_per_period: classesPerPeriod ?? null,
        applies_to: appliesTo,
        applies_to_types: appliesToTypes ?? null,
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
        status,
      })
      .select('*')
      .single()

    if (insertErr || !rawRow) {
      console.error('POST /api/coach/memberships — insert', insertErr)
      // Best-effort: archive the Stripe price if the DB write failed.
      if (stripePriceId && stripe) {
        try { await stripe.prices.update(stripePriceId, { active: false }) } catch { /* ignore */ }
      }
      if (stripeProductId && stripe) {
        try { await stripe.products.update(stripeProductId, { active: false }) } catch { /* ignore */ }
      }
      return NextResponse.json({ error: 'Could not create membership plan' }, { status: 500 })
    }

    const plan = rawRow as unknown as MembershipPlan
    return NextResponse.json({ data: { ...plan, memberCount: 0 } }, { status: 201 })
  } catch (e) {
    console.error('POST /api/coach/memberships', e)
    return NextResponse.json(
      { error: 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}
