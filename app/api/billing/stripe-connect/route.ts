import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createClient } from '@/lib/supabase-server'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { resolveAppBaseUrl } from '@/lib/app-base-url'
import { stripe } from '@/lib/stripe'

/**
 * GET /api/billing/stripe-connect — start Stripe Connect Express onboarding (workspace owner only).
 * Redirects to Stripe; return URL completes in /api/billing/stripe-connect/return.
 */
export async function GET(request: Request) {
  const base = resolveAppBaseUrl(request)
  const redirectErr = (code: string) =>
    NextResponse.redirect(`${base}/coach/settings?tab=payments&stripe_error=${encodeURIComponent(code)}`)

  try {
    if (!stripe) {
      return redirectErr('stripe_not_configured')
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(`${base}/login`)
    }

    const workspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
    if (!workspaceId) {
      return redirectErr('no_workspace')
    }

    const { success, retryAfter } = await checkRateLimitAsync(`stripe-connect:${user.id}`, {
      windowMs: 60_000,
      max: 20,
    })
    if (!success) {
      const res = redirectErr('rate_limited')
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .select('id, owner_id, stripe_connect_account_id')
      .eq('id', workspaceId)
      .maybeSingle()

    if (wsErr || !ws) {
      return redirectErr('workspace_not_found')
    }
    if (ws.owner_id !== user.id) {
      return redirectErr('owner_only')
    }

    let connectAccountId = ws.stripe_connect_account_id as string | null

    if (!connectAccountId) {
      const country = (process.env.STRIPE_CONNECT_DEFAULT_COUNTRY ?? 'US').trim().toUpperCase() || 'US'
      try {
        const createParams: Stripe.AccountCreateParams = {
          type: 'express',
          country,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          metadata: { workspace_id: workspaceId },
        }
        if (user.email) {
          createParams.email = user.email
        }
        const account = await stripe.accounts.create(createParams)
        connectAccountId = account.id
        const { error: upErr } = await supabase
          .from('workspaces')
          .update({ stripe_connect_account_id: connectAccountId })
          .eq('id', workspaceId)
          .eq('owner_id', user.id)
        if (upErr) {
          return redirectErr('could_not_save_account')
        }
      } catch {
        return redirectErr('stripe_failed')
      }
    }

    try {
      const link = await stripe.accountLinks.create({
        account: connectAccountId,
        refresh_url: `${base}/api/billing/stripe-connect`,
        return_url: `${base}/api/billing/stripe-connect/return`,
        type: 'account_onboarding',
      })
      if (!link.url) {
        return redirectErr('no_link_url')
      }
      return NextResponse.redirect(link.url)
    } catch {
      return redirectErr('stripe_failed')
    }
  } catch {
    return redirectErr('unknown')
  }
}
