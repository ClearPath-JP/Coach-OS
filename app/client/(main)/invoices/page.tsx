import { createClient } from '@/lib/supabase-server'
import { normalizeEmail } from '@/lib/utils'
import {
  ClientInvoicesBackLink,
  ClientInvoicesList,
  type ClientInvoiceRow,
} from '@/components/client/ClientInvoicesList'

export const dynamic = 'force-dynamic'

export default async function ClientInvoicesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return (
      <main className="client-page-content min-h-screen px-4 py-6 md:px-6">
        <p className="text-[14px] text-[var(--text-tertiary)]">Please log in to view your invoices.</p>
      </main>
    )
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('email', normalizeEmail(user.email))
    .maybeSingle()

  if (!client) {
    return (
      <main className="client-page-content min-h-screen px-4 py-6 md:px-6">
        <p className="text-[14px] text-[var(--text-tertiary)]">We couldn&apos;t find your client record.</p>
      </main>
    )
  }

  const { data: invoices } = await supabase
    .from('session_invoices')
    .select(
      `
      id, amount_cents, currency, status, due_date, paid_at, created_at,
      session_packages(id, title, description)
    `
    )
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })

  const list = (invoices ?? []) as unknown as ClientInvoiceRow[]

  return (
    <main className="client-page-content min-h-screen px-4 py-6 md:px-6">
      <ClientInvoicesBackLink />
      <h1 className="text-[22px] font-bold text-[var(--text-primary)]">Invoices</h1>

      <ClientInvoicesList clientId={client.id} invoices={list} />
    </main>
  )
}
