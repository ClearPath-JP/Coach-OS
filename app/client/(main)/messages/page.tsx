import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizeEmail } from '@/lib/utils'
import { ClientMessagesContent } from './ClientMessagesContent'

/**
 * Client messages page: single thread with their coach.
 * Resolves client by user email, then coach user_id from workspace.
 *
 * Note: `coaches` RLS only allows SELECT where user_id = auth.uid() (the coach).
 * Clients cannot read coach rows with the user-scoped client — use service role
 * for the coach lookup after the client row is verified (same as POST /api/messages).
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
    .select('id, workspace_id')
    .eq('email', lookupEmail)
    .maybeSingle()

  if (!client) {
    return (
      <main className="min-h-screen p-6">
        <p className="text-[var(--color-muted)]">
          We couldn&apos;t find your client record. Please contact your coach.
        </p>
      </main>
    )
  }

  // RLS blocks clients from reading `coaches`; resolve with service client after client is verified.
  const svc = createServiceClient()
  const { data: coachRows } = await svc
    .from('coaches')
    .select('user_id, role')
    .eq('workspace_id', client.workspace_id)
    .order('role', { ascending: true })
    .limit(1)

  const coachRow = coachRows?.[0] ?? null

  if (!coachRow?.user_id) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <p className="max-w-md text-[15px] text-[var(--color-muted)]">
          Contact your coach to get started.
        </p>
      </main>
    )
  }

  let coachName = 'Your coach'
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, display_name')
    .eq('id', coachRow.user_id)
    .maybeSingle()
  if (profile) {
    coachName = profile.display_name?.trim() || profile.full_name?.trim() || coachName
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col p-4 lg:p-6">
      <ClientMessagesContent clientId={client.id} coachName={coachName} />
    </main>
  )
}
