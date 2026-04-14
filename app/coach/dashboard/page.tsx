import { redirect } from 'next/navigation'

/** Schedule IS the home screen. Redirect any dashboard hits. */
export default function CoachDashboardPage() {
  redirect('/coach/schedule')
}
