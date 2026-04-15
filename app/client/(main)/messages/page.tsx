import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { resolveCoachUserIdForClientRow } from '@/lib/resolve-coach-user-for-client'
import { normalizeEmail } from '@/lib/utils'
import { ClientMessagesContent } from './ClientMessagesContent'

export const dynamic = 'force-dynamic'

/**
 * Client messages page: single thread with their coach.
 * Resolves client by user email, then coach user_id from workspace.
 *
 * Resolves the assigned coach via `clients.coach_id`, with service fallback if unset.
 */
export default async function ClientMessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    redirect('/login')
  }

  const lookupEmail = normalizeEmail(user.email)

  const { data: client } = await supabase
    .from('clients')
    .select('id, workspace_id, coach_id')
    .eq('email', lookupEmail)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!client) {
    return (
      <main className="client-page-content min-h-screen px-4 py-6 md:px-6">
        <p className="text-[14px] text-[var(--text-tertiary)]">
          We couldn&apos;t find your client record. Please contact your coach.
        </p>
      </main>
    )
  }

  const coachUserId = await resolveCoachUserIdForClientRow({
    workspace_id: client.workspace_id,
    coach_id: client.coach_id,
  })

  if (!coachUserId) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <p className="max-w-md text-[15px] text-[var(--text-tertiary)]">
          Contact your coach to get started.
        </p>
      </main>
    )
  }

  let coachName = 'Your coach'
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, display_name')
    .eq('id', coachUserId)
    .maybeSingle()
  if (profile) {
    coachName = profile.display_name?.trim() || profile.full_name?.trim() || coachName
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center text-[15px] text-[var(--text-tertiary)]">
            Loading messages…
          </div>
        }
      >
        <ClientMessagesContent clientId={client.id} coachName={coachName} />
      </Suspense>
    </main>
  )
}
