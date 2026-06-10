import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { SubscribePageContent } from './SubscribePageContent'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Choose Your Plan — Korva' }

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; cancelled?: string }>
}) {
  const { error, cancelled } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/subscribe')

  // If already has workspace (already paid), go to dashboard
  const { data: existingCoach } = await supabase
    .from('coaches')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (existingCoach?.workspace_id) redirect('/coach/dashboard')

  return (
    <SubscribePageContent
      userEmail={user.email ?? ''}
      errorCode={typeof error === 'string' && error.length > 0 ? error : null}
      checkoutCancelled={cancelled === 'true'}
    />
  )
}
