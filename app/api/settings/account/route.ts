import { NextResponse } from 'next/server'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { stripe } from '@/lib/stripe'

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
    if (!workspaceId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { success, retryAfter } = await checkRateLimitAsync(`settings-delete-account:${user.id}`, {
      windowMs: 60 * 60 * 1000,
      max: 1,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait an hour and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json().catch(() => null)
    if (body?.confirm !== 'DELETE MY ACCOUNT') {
      return NextResponse.json({ error: "Confirmation must be exactly 'DELETE MY ACCOUNT'" }, { status: 400 })
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('workspace_id', workspaceId)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subscription?.stripe_subscription_id && stripe) {
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled', cancel_at_period_end: true, updated_at: new Date().toISOString() })
        .eq('workspace_id', workspaceId)
    }

    const { error } = await supabase
      .from('workspaces')
      .update({ status: 'deleted' })
      .eq('id', workspaceId)
    if (error) {
      return NextResponse.json({ error: error.message || 'Could not delete account' }, { status: 500 })
    }

    return NextResponse.json({ data: 'Account deleted' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
