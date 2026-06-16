import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase-server'
import { activateNewCoach, type WorkspacePlan } from '@/lib/new-coach-activation'
import { logServerError } from '@/lib/log-server-error'
import type Stripe from 'stripe'

/**
 * GET /api/billing/new-coach-activate — Stripe success_url redirect target.
 * Verifies the checkout session + logged-in user, then runs the shared
 * activateNewCoach() (also used by the webhook backstop, so closing the tab on
 * Stripe's success page can no longer strand a paid-but-workspace-less coach).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin

  if (!sessionId || !stripe) {
    return NextResponse.redirect(`${baseUrl}/subscribe?error=missing_session`)
  }

  try {
    // Verify the authenticated user matches the Stripe session owner
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.redirect(`${baseUrl}/subscribe?error=not_authenticated`)
    }

    // Verify the Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return NextResponse.redirect(`${baseUrl}/subscribe?error=payment_incomplete`)
    }

    const userId = session.metadata?.user_id
    const plan = (session.metadata?.plan ?? 'starter') as WorkspacePlan

    if (!userId) {
      return NextResponse.redirect(`${baseUrl}/subscribe?error=missing_user`)
    }

    // Ensure the logged-in user owns this Stripe checkout session
    if (authUser.id !== userId) {
      return NextResponse.redirect(`${baseUrl}/subscribe?error=user_mismatch`)
    }

    const service = createServiceClient()

    const sub = session.subscription
    const stripeSubObj = typeof sub === 'object' && sub !== null ? (sub as Stripe.Subscription) : null
    const stripeSubId = typeof sub === 'string' ? sub : stripeSubObj?.id ?? null
    const periodEnd = stripeSubObj?.current_period_end
      ? new Date(stripeSubObj.current_period_end * 1000).toISOString()
      : null
    const trialEnd = stripeSubObj?.trial_end
      ? new Date(stripeSubObj.trial_end * 1000).toISOString()
      : null

    const result = await activateNewCoach(service, {
      userId,
      plan,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
      stripeSubscriptionId: stripeSubId,
      // Record the real Stripe status: a 14-day-trial checkout creates a `trialing`
      // subscription (no charge yet); an immediate-pay checkout creates `active`. Mirrors
      // the webhook backstop's mapping so both activation paths agree. Falls back to
      // `active` if the subscription object somehow didn't expand (preserves prior behavior).
      subscriptionStatus:
        stripeSubObj?.status === 'trialing'
          ? 'trialing'
          : stripeSubObj?.status === 'past_due'
            ? 'past_due'
            : 'active',
      currentPeriodEnd: periodEnd,
      trialEndsAt: trialEnd,
    })

    if (result.ok) {
      return NextResponse.redirect(`${baseUrl}/coach/dashboard`)
    }

    // From here on `result` is the failure variant — reason is always a string.
    const failureReason: string = result.reason
    const wasInProgress: boolean = result.inProgress ?? false

    if (wasInProgress) {
      // The webhook holds the activation claim right now — wait briefly for it to finish.
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        const { data: coachRow } = await service
          .from('coaches')
          .select('workspace_id')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle()
        if (coachRow?.workspace_id) {
          return NextResponse.redirect(`${baseUrl}/coach/dashboard`)
        }
      }
    }

    console.error('[new-coach-activate] activation failed:', failureReason)
    await logServerError('GET /api/billing/new-coach-activate', new Error(failureReason), {
      userId,
      checkoutSessionId: sessionId,
      inProgress: wasInProgress,
    })
    return NextResponse.redirect(`${baseUrl}/subscribe?error=activation_failed`)
  } catch (err) {
    console.error('[new-coach-activate] error:', err instanceof Error ? err.message : err)
    await logServerError('GET /api/billing/new-coach-activate', err, { checkoutSessionId: sessionId })
    return NextResponse.redirect(`${baseUrl}/subscribe?error=activation_failed`)
  }
}
