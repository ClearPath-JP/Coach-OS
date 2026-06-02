import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { stripe } from '@/lib/stripe'
import { patchMembershipPlanSchema } from '@/lib/validations'

// ---------------------------------------------------------------------------
// Types — membership_plans columns not yet in generated Supabase types.
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

// ---------------------------------------------------------------------------
// Shared helper: load + ownership-verify a plan
// ---------------------------------------------------------------------------

type ResolvedPlan =
  | { plan: MembershipPlan; svc: ReturnType<typeof createServiceClient> }
  | { notFound: true }
  | { forbidden: true }

async function resolvePlan(
  planId: string,
  workspaceId: string,
  userId: string
): Promise<ResolvedPlan> {
  const svc = createServiceClient()

  const { data: raw, error } = await svc
    .from('membership_plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle()

  if (error || !raw) return { notFound: true }

  const plan = raw as unknown as MembershipPlan

  // Verify both workspace ownership and that this coach owns the plan.
  if (plan.workspace_id !== workspaceId || plan.coach_id !== userId) return { forbidden: true }

  return { plan, svc }
}

// ---------------------------------------------------------------------------
// PATCH /api/coach/memberships/[id]
// ---------------------------------------------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params
    if (!planId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(
      `memberships-patch:${user.id}`,
      { windowMs: 60_000, max: 60 }
    )
    if (!rateOk) {
      const res = NextResponse.json(
        { error: 'Too many requests — try again shortly' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json()
    const parsed = patchMembershipPlanSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const resolved = await resolvePlan(planId, workspaceId, user.id)
    if ('notFound' in resolved) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if ('forbidden' in resolved) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { plan, svc } = resolved
    const d = parsed.data

    // Build the DB update object.
    const updates: Record<string, unknown> = {}
    if (d.name !== undefined) updates.name = d.name
    if (d.accessType !== undefined) updates.access_type = d.accessType
    if (d.classesPerPeriod !== undefined) updates.classes_per_period = d.classesPerPeriod ?? null
    if (d.appliesTo !== undefined) updates.applies_to = d.appliesTo
    if (d.appliesToTypes !== undefined) updates.applies_to_types = d.appliesToTypes ?? null
    if (d.status !== undefined) updates.status = d.status

    // ------------------------------------------------------------------
    // Stripe price handling (prices are immutable — always create new).
    // ------------------------------------------------------------------

    const priceChanged =
      (d.priceCents !== undefined && d.priceCents !== plan.price_cents) ||
      (d.currency !== undefined && d.currency !== plan.currency)

    if (d.priceCents !== undefined) updates.price_cents = d.priceCents
    if (d.currency !== undefined) updates.currency = d.currency

    const effectiveStatus = d.status ?? plan.status
    const needsStripe = effectiveStatus !== 'draft'

    if (priceChanged || (d.status === 'active' && plan.status === 'draft' && !plan.stripe_price_id)) {
      // Activating a draft with no price, OR changing price/currency on a live plan.
      if (!stripe) {
        return NextResponse.json(
          { error: 'Stripe is not configured — cannot activate or reprice this plan' },
          { status: 503 }
        )
      }

      if (!needsStripe) {
        // Staying draft — no Stripe action needed; DB fields already set above.
      } else {
        // Ensure a product exists (draft plans skip product creation).
        let productId = plan.stripe_product_id
        if (!productId) {
          const product = await stripe.products.create({
            name: d.name ?? plan.name,
            metadata: { workspace_id: workspaceId },
          })
          productId = product.id
          updates.stripe_product_id = productId
        } else if (d.name !== undefined) {
          // Keep product name in sync.
          try {
            await stripe.products.update(productId, { name: d.name })
          } catch { /* non-fatal */ }
        }

        // Archive old price (if any) — prices are immutable, so we create a new one.
        if (plan.stripe_price_id) {
          try {
            await stripe.prices.update(plan.stripe_price_id, { active: false })
          } catch { /* non-fatal — old price may already be archived */ }
        }

        const newPrice = await stripe.prices.create({
          product: productId,
          unit_amount: d.priceCents ?? plan.price_cents,
          currency: d.currency ?? plan.currency,
          recurring: { interval: 'month' },
        })
        updates.stripe_price_id = newPrice.id
      }
    } else if (d.name !== undefined && plan.stripe_product_id && stripe) {
      // Name changed but price didn't — just update the product name.
      try {
        await stripe.products.update(plan.stripe_product_id, { name: d.name })
      } catch { /* non-fatal */ }
    }

    updates.updated_at = new Date().toISOString()

    const { data: rawUpdated, error: updateErr } = await svc
      .from('membership_plans')
      .update(updates)
      .eq('id', planId)
      .select('*')
      .single()

    if (updateErr || !rawUpdated) {
      console.error('PATCH /api/coach/memberships/[id] — update', updateErr)
      return NextResponse.json({ error: 'Could not update membership plan' }, { status: 500 })
    }

    return NextResponse.json({ data: rawUpdated as unknown as MembershipPlan })
  } catch (e) {
    console.error('PATCH /api/coach/memberships/[id]', e)
    return NextResponse.json(
      { error: 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/coach/memberships/[id]  — soft-archive
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params
    if (!planId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(
      `memberships-delete:${user.id}`,
      { windowMs: 60_000, max: 30 }
    )
    if (!rateOk) {
      const res = NextResponse.json(
        { error: 'Too many requests — try again shortly' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const resolved = await resolvePlan(planId, workspaceId, user.id)
    if ('notFound' in resolved) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if ('forbidden' in resolved) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { plan, svc } = resolved

    if (plan.status === 'archived') {
      return NextResponse.json({ error: 'Plan is already archived' }, { status: 409 })
    }

    // Archive the Stripe price so no new subscriptions can be created against it.
    // Existing subscriptions reference the subscription_id, not the price, so they
    // continue until canceled — this is intentional.
    if (plan.stripe_price_id && stripe) {
      try {
        await stripe.prices.update(plan.stripe_price_id, { active: false })
      } catch { /* non-fatal — may already be inactive */ }
    }

    const { error: archiveErr } = await svc
      .from('membership_plans')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', planId)

    if (archiveErr) {
      console.error('DELETE /api/coach/memberships/[id] — archive', archiveErr)
      return NextResponse.json({ error: 'Could not archive membership plan' }, { status: 500 })
    }

    return NextResponse.json({ data: { id: planId, status: 'archived' } })
  } catch (e) {
    console.error('DELETE /api/coach/memberships/[id]', e)
    return NextResponse.json(
      { error: 'Something went wrong — try again' },
      { status: 500 }
    )
  }
}
