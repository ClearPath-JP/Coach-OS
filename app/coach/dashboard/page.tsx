import { createClient } from '@/lib/supabase-server'
import { CoachDashboardHome } from './CoachDashboardHome'

export default async function CoachDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let coachName = 'Coach'
  if (user) {
    const { data: p } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
    coachName = p?.full_name?.trim() || user.email?.split('@')[0]?.trim() || 'Coach'
  }

  return <CoachDashboardHome coachName={coachName} />
}
