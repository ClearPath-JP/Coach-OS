import { createClient } from '@/lib/supabase-server'
import { CoachDashboardContent } from './CoachDashboardContent'

export async function CoachDashboardWithProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let coachDisplayName = 'Coach'
  if (user) {
    const { data: p } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    coachDisplayName =
      p?.full_name?.trim() || user.email?.split('@')[0]?.trim() || coachDisplayName
  }
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <CoachDashboardContent coachDisplayName={coachDisplayName} />
    </div>
  )
}
