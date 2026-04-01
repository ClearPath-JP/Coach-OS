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
      <main className="min-h-screen p-6">
        <p className="text-[var(--color-muted)]">Please log in to view your invoices.</p>
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
      <main className="min-h-screen p-6">
        <p className="text-[var(--color-muted)]">We couldn&apos;t find your client record.</p>
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
    <main className="min-h-screen p-6">
      <ClientInvoicesBackLink />
      <h1 className="text-xl font-medium text-[var(--color-ink)]">My invoices</h1>
      <p className="mt-1 text-[15px] text-[var(--color-muted)]">
        View your session invoices and payment status.
      </p>

      <ClientInvoicesList clientId={client.id} invoices={list} />
    </main>
  )
}
