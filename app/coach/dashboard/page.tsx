import { createClient } from '@/lib/supabase-server'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { CoachDashboardHome } from './CoachDashboardHome'

export default async function CoachDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let coachName = 'Coach'
  let trialEndsAt: string | null = null
  if (user) {
    const { data: p } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
    coachName = p?.full_name?.trim() || user.email?.split('@')[0]?.trim() || 'Coach'

    // Founding free-trial countdown: surface trial_ends_at only while it's still in the
    // future (card is on file, so this is a heads-up banner, not a paywall).
    const workspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
    if (workspaceId) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('trial_ends_at')
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      const ends = sub?.trial_ends_at as string | null | undefined
      if (ends && new Date(ends).getTime() > Date.now()) {
        trialEndsAt = ends
      }
    }
  }

  return <CoachDashboardHome coachName={coachName} trialEndsAt={trialEndsAt} />
}
