import { NextResponse } from 'next/server'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/service'

type Ctx = { params: Promise<{ workspaceId: string }> }

export async function POST(request: Request, context: Ctx) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth
    const { workspaceId } = await context.params
    const service = createServiceClient()

    const trialEnds = new Date()
    trialEnds.setDate(trialEnds.getDate() + 14)

    const { data: existing } = await service
      .from('subscriptions')
      .select('workspace_id')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (existing) {
      await service
        .from('subscriptions')
        .update({ trial_ends_at: trialEnds.toISOString(), status: 'trialing' })
        .eq('workspace_id', workspaceId)
    } else {
      await service.from('subscriptions').insert({
        workspace_id: workspaceId,
        plan: 'starter',
        status: 'trialing',
        trial_ends_at: trialEnds.toISOString(),
      })
    }

    await logAdminAudit({
      action: 'subscription_trial_extended',
      userId: auth.id,
      workspaceId,
      request,
      metadata: { trial_ends_at: trialEnds.toISOString() },
    })

    return NextResponse.json({ data: { trialEndsAt: trialEnds.toISOString() } })
  } catch {
    return NextResponse.json({ error: 'Could not extend trial' }, { status: 500 })
  }
}
