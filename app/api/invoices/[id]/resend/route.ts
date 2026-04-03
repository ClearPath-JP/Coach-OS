import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { normalizeEmail } from '@/lib/utils'

/**
 * POST /api/invoices/[id]/resend — coach posts another invoice card message (same invoice) to the client thread.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`api-invoices-resend:${user.id}`, {
      windowMs: 60_000,
      max: 30,
    })
    if (!rateOk) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: invoiceId } = await context.params
    if (!invoiceId?.trim()) {
      return NextResponse.json({ error: 'Invalid invoice' }, { status: 400 })
    }

    const { data: invoice, error: invErr } = await supabase
      .from('session_invoices')
      .select('id, workspace_id, client_id, amount_cents, currency, status, due_date, package_id')
      .eq('id', invoiceId)
      .eq('workspace_id', coach.workspace_id)
      .maybeSingle()

    if (invErr || !invoice) {
      return NextResponse.json({ error: "We couldn't find that invoice" }, { status: 404 })
    }

    if (invoice.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending invoices can be resent' }, { status: 400 })
    }

    const { data: pkg } = await supabase
      .from('session_packages')
      .select('id, title, description')
      .eq('id', invoice.package_id)
      .eq('workspace_id', coach.workspace_id)
      .maybeSingle()

    if (!pkg) {
      return NextResponse.json({ error: "We couldn't load this invoice's package" }, { status: 400 })
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id, email')
      .eq('id', invoice.client_id)
      .eq('workspace_id', coach.workspace_id)
      .maybeSingle()

    if (!client?.email) {
      return NextResponse.json({ error: "We couldn't find that client" }, { status: 400 })
    }

    const emailNorm = normalizeEmail(client.email)
    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', emailNorm)
      .maybeSingle()

    if (!clientProfile?.id) {
      return NextResponse.json(
        { error: "This client doesn't have a login yet — they need a client account before you can resend in chat" },
        { status: 400 }
      )
    }

    const invoiceCardContent = JSON.stringify({
      type: 'invoice',
      invoiceId: invoice.id,
      packageTitle: pkg.title,
      packageDescription: pkg.description ?? null,
      amountCents: invoice.amount_cents,
      currency: invoice.currency,
      status: invoice.status,
      dueDate: invoice.due_date,
    })

    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        workspace_id: coach.workspace_id,
        sender_id: user.id,
        recipient_id: clientProfile.id,
        client_id: client.id,
        content: invoiceCardContent,
        message_type: 'invoice',
      })
      .select('id')
      .single()

    if (msgError || !message) {
      return NextResponse.json({ error: 'Could not resend invoice message — try again' }, { status: 500 })
    }

    return NextResponse.json({ data: { messageId: message.id } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
