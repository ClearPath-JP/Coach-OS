import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'

/**
 * GET /api/client/memberships
 *
 * Returns all active membership plans for the client's workspace, plus the
 * client's own live membership (status in active/trialing/past_due) joined to
 * its plan details — or null if none exists.
 *
 * Uses the authenticated supabase client so RLS applies:
 *  - membership_plans: workspace_id = current_workspace_id()  (clients are in workspace via coaches row or clients table)
 *  - client_memberships: workspace_id = current_workspace_id() AND client owns the row (email match RLS in migration)
 */
export async function GET() {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { user, clientId, workspaceId, supabase } = auth

    const { success, retryAfter } = await checkRateLimitAsync(
      `client-memberships-get:${user.id}`,
      { windowMs: 60_000, max: 60 }
    )
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many requests — please wait a moment' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    // 1. Active plans for this workspace (RLS-safe — workspace_id = current_workspace_id()).
    const { data: plansRaw, error: plansErr } = await supabase
      .from('membership_plans')
      .select(
        'id, name, price_cents, currency, access_type, classes_per_period, applies_to, applies_to_types'
      )
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .order('price_cents', { ascending: true })

    if (plansErr) {
      console.error('GET /api/client/memberships — plans query', plansErr)
      return NextResponse.json({ error: 'Could not load plans' }, { status: 500 })
    }

    // 2. Client's own live membership (RLS filters to their row only).
    //    Join to the plan via plan_id.
    const { data: membershipRaw, error: membershipErr } = await supabase
      .from('client_memberships')
      .select(
        `id,
         status,
         current_period_end,
         classes_used_this_period,
         canceled_at,
         plan_id,
         membership_plans (
           name,
           access_type,
           classes_per_period
         )`
      )
      .eq('client_id', clientId)
      .eq('workspace_id', workspaceId)
      .in('status', ['active', 'trialing', 'past_due'])
      .maybeSingle()

    if (membershipErr) {
      console.error('GET /api/client/memberships — membership query', membershipErr)
      return NextResponse.json({ error: 'Could not load membership' }, { status: 500 })
    }

    // Shape the membership response.
    type PlanJoin = {
      name: string | null
      access_type: string | null
      classes_per_period: number | null
    }

    type MembershipRow = {
      id: string
      status: string
      current_period_end: string | null
      classes_used_this_period: number
      canceled_at: string | null
      plan_id: string
      membership_plans: PlanJoin | PlanJoin[] | null
    }

    const membership: {
      id: string
      status: string
      current_period_end: string | null
      classes_used_this_period: number
      canceled_at: string | null
      plan_id: string
      plan_name: string | null
      plan_access_type: string | null
      plan_classes_per_period: number | null
    } | null = (() => {
      if (!membershipRaw) return null
      const m = membershipRaw as unknown as MembershipRow
      // Supabase returns joined table as an object (not array) when using .maybeSingle()
      const planJoin = Array.isArray(m.membership_plans)
        ? (m.membership_plans[0] ?? null)
        : (m.membership_plans ?? null)
      return {
        id: m.id,
        status: m.status,
        current_period_end: m.current_period_end,
        classes_used_this_period: m.classes_used_this_period,
        canceled_at: m.canceled_at,
        plan_id: m.plan_id,
        plan_name: planJoin?.name ?? null,
        plan_access_type: planJoin?.access_type ?? null,
        plan_classes_per_period: planJoin?.classes_per_period ?? null,
      }
    })()

    return NextResponse.json({
      data: {
        plans: plansRaw ?? [],
        membership,
      },
    })
  } catch (err) {
    console.error('GET /api/client/memberships', err)
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}
