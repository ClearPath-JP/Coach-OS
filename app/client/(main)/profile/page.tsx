import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { normalizeEmail } from '@/lib/utils'
import { ClientProfileContent } from './ClientProfileContent'

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
      <main className="p-6">
        <p className="text-[var(--text-tertiary)]">We couldn&apos;t find your client record.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <ClientProfileContent
        clientId={client.id}
        initialFirstName={client.first_name ?? ''}
        initialLastName={client.last_name ?? ''}
        email={user.email}
      />
    </main>
  )
}
