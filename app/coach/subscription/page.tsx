import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase/service'
import { SubscriptionPageContent } from './SubscriptionPageContent'

export const metadata = { title: 'Subscription' }
export const dynamic = 'force-dynamic'

export default async function SubscriptionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: coach } = await supabase
    .from('coaches')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!coach?.workspace_id) redirect('/coach/dashboard')

  const service = createServiceClient()

  const [subResult, workspaceResult, clientCountResult] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('plan, status, current_period_end, trial_ends_at')
      .eq('workspace_id', coach.workspace_id)
      .maybeSingle(),
    supabase
      .from('workspaces')
      .select('stripe_customer_id, max_clients')
      .eq('id', coach.workspace_id)
      .maybeSingle(),
    service
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', coach.workspace_id),
  ])

  const subscription = subResult.data
    ? {
        plan: subResult.data.plan as 'free' | 'founding' | 'starter' | 'pro' | 'scale',
        status: subResult.data.status as 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused',
        current_period_end: subResult.data.current_period_end,
        trial_ends_at: subResult.data.trial_ends_at,
      }
    : null

  const hasStripeCustomer = Boolean(workspaceResult.data?.stripe_customer_id)
  const clientCount = clientCountResult.count ?? 0

  return (
    <Suspense fallback={null}>
      <SubscriptionPageContent
        subscription={subscription}
        hasStripeCustomer={hasStripeCustomer}
        clientCount={clientCount}
      />
    </Suspense>
  )
}
