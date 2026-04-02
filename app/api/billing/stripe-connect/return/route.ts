import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { resolveAppBaseUrl } from '@/lib/app-base-url'
import { stripe } from '@/lib/stripe'

/**
 * GET /api/billing/stripe-connect/return — after Stripe onboarding; syncs charges_enabled → workspace.stripe_connected.
 */
export async function GET(request: Request) {
  const base = resolveAppBaseUrl(request)

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(`${base}/login`)
    }

    const workspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
    if (!workspaceId) {
      return NextResponse.redirect(`${base}/coach/settings?tab=payments&stripe_error=no_workspace`)
    }

    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .select('id, owner_id, stripe_connect_account_id')
      .eq('id', workspaceId)
      .maybeSingle()

    if (wsErr || !ws || ws.owner_id !== user.id) {
      return NextResponse.redirect(`${base}/coach/settings?tab=payments&stripe_error=owner_only`)
    }

    const connectId = ws.stripe_connect_account_id as string | null
    if (!connectId || !stripe) {
      return NextResponse.redirect(`${base}/coach/settings?tab=payments&stripe_error=no_connect_account`)
    }

    let ready = false
    try {
      const acct = await stripe.accounts.retrieve(connectId)
      ready = acct.charges_enabled === true && acct.details_submitted === true
    } catch {
      ready = false
    }

    await supabase
      .from('workspaces')
      .update({ stripe_connected: ready })
      .eq('id', workspaceId)
      .eq('owner_id', user.id)

    const q = ready ? 'stripe_return=ready' : 'stripe_return=pending'
    return NextResponse.redirect(`${base}/coach/settings?tab=payments&${q}`)
  } catch {
    return NextResponse.redirect(`${base}/coach/settings?tab=payments&stripe_error=unknown`)
  }
}
