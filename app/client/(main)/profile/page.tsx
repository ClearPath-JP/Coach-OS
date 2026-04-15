import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { normalizeEmail } from '@/lib/utils'
import { ClientProfileContent } from './ClientProfileContent'

export const dynamic = 'force-dynamic'

export default async function ClientProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const { data: client } = await supabase
    .from('clients')
    .select('id, first_name, last_name')
    .eq('email', normalizeEmail(user.email))
    .maybeSingle()

  if (!client) {
    return (
      <main className="client-page-content min-h-screen px-4 py-6 md:px-6">
        <p className="text-[14px] text-[var(--text-tertiary)]">We couldn&apos;t find your client record.</p>
      </main>
    )
  }

  return (
    <main className="client-page-content min-h-screen">
      <ClientProfileContent
        clientId={client.id}
        initialFirstName={client.first_name ?? ''}
        initialLastName={client.last_name ?? ''}
        email={user.email}
      />
    </main>
  )
}
