import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase-server'

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
    const plan = (session.metadata?.plan ?? 'starter') as 'founding' | 'starter' | 'pro' | 'scale'

    if (!userId) {
      return NextResponse.redirect(`${baseUrl}/subscribe?error=missing_user`)
    }

    // Ensure the logged-in user owns this Stripe checkout session
    if (authUser.id !== userId) {
      return NextResponse.redirect(`${baseUrl}/subscribe?error=user_mismatch`)
    }

    const service = createServiceClient()

    // Check if workspace already created (idempotent - in case of double redirect)
    const { data: existingCoach } = await service
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existingCoach?.workspace_id) {
      return NextResponse.redirect(`${baseUrl}/coach/dashboard`)
    }

    // Get user details (via service role for admin access)
    const { data: { user: adminUser } } = await service.auth.admin.getUserById(userId)
    if (!adminUser) {
      return NextResponse.redirect(`${baseUrl}/subscribe?error=user_not_found`)
    }

    const firstName = (adminUser.user_metadata?.full_name as string)?.split(' ')[0]?.trim() || 'Coach'
    const workspaceName = `${firstName}'s Workspace`

    // Create workspace
    const { data: workspace, error: wsError } = await service
      .from('workspaces')
      .insert({
        name: workspaceName,
        owner_id: userId,
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
      })
      .select('id')
      .single()

    if (wsError || !workspace) {
      console.error('[new-coach-activate] workspace insert error:', wsError?.message)
      return NextResponse.redirect(`${baseUrl}/subscribe?error=workspace_failed`)
    }

    const workspaceId = workspace.id
    const fullName = (adminUser.user_metadata?.full_name as string) ?? firstName

    // Create profile
    await service.from('profiles').upsert({
      id: userId,
      email: adminUser.email ?? '',
      full_name: fullName,
      role: 'coach',
      workspace_id: workspaceId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    // Create coach record
    await service.from('coaches').insert({
      user_id: userId,
      workspace_id: workspaceId,
      role: 'owner',
    })

    // Create subscription record from the Stripe subscription
    const sub = session.subscription
    const stripeSubId = typeof sub === 'string' ? sub : sub?.id ?? null
    const stripeSubObj = typeof sub === 'object' && sub !== null ? sub : null
    const periodEnd = stripeSubObj?.current_period_end
      ? new Date((stripeSubObj as { current_period_end: number }).current_period_end * 1000).toISOString()
      : null

    if (stripeSubId) {
      await service.from('subscriptions').upsert({
        workspace_id: workspaceId,
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
        stripe_subscription_id: stripeSubId,
        plan,
        status: 'active',
        current_period_end: periodEnd,
      }, { onConflict: 'workspace_id' })
    }

    return NextResponse.redirect(`${baseUrl}/coach/dashboard`)
  } catch (err) {
    console.error('[new-coach-activate] error:', err instanceof Error ? err.message : err)
    return NextResponse.redirect(`${baseUrl}/subscribe?error=activation_failed`)
  }
}
