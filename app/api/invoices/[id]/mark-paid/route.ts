import { format } from 'date-fns'
import { NextResponse } from 'next/server'
import { invalidateCoachAnalyticsCaches, invalidatePaymentSummaryCaches } from '@/lib/api-cache'
import { logAuditEvent } from '@/lib/audit-log'
import { createClient } from '@/lib/supabase-server'
import { markInvoicePaidSchema } from '@/lib/validations'
import { checkRateLimitAsync } from '@/lib/rate-limit'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/invoices/[id]/mark-paid — set status = paid, paid_at = now(), save payment details.
 * If invoice has no session yet, creates one (placeholder). Coach only.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: invoiceId } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`api-invoices:${user.id}`, {
      windowMs: 60_000,
      max: 60,
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

    const body = await request.json()
    const parsed = markInvoicePaidSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { data: invoice, error: fetchErr } = await supabase
      .from('session_invoices')
      .select('id, workspace_id, client_id, coach_id, amount_cents, due_date, session_id, message_id')
      .eq('id', invoiceId)
      .eq('workspace_id', coach.workspace_id)
      .single()

    if (fetchErr || !invoice) {
      return NextResponse.json(
        { error: "We couldn't find that invoice" },
        { status: 404 }
      )
    }

    if (invoice.session_id) {
      const { error: upErr } = await supabase
        .from('session_invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: parsed.data.paymentMethod,
          payment_reference: parsed.data.paymentReference ?? null,
          payment_method_note: parsed.data.paymentMethodNote ?? null,
          amount_cents: parsed.data.amountCents ?? invoice.amount_cents,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId)
        .eq('workspace_id', coach.workspace_id)

      if (upErr) {
        return NextResponse.json(
          { error: upErr.message || 'Could not record payment' },
          { status: 500 }
        )
      }
    } else {
      const scheduledTime = invoice.due_date
        ? new Date(invoice.due_date).toISOString()
        : new Date().toISOString()

      const { data: newSession, error: sessionErr } = await supabase
        .from('sessions')
        .insert({
          workspace_id: coach.workspace_id,
          coach_id: invoice.coach_id,
          client_id: invoice.client_id,
          scheduled_time: scheduledTime,
          status: 'pending',
          amount_cents: parsed.data.amountCents ?? invoice.amount_cents,
        })
        .select('id')
        .single()

      if (sessionErr) {
        return NextResponse.json(
          { error: 'Could not create session — try again' },
          { status: 500 }
        )
      }

      const { error: upErr } = await supabase
        .from('session_invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: parsed.data.paymentMethod,
          payment_reference: parsed.data.paymentReference ?? null,
          payment_method_note: parsed.data.paymentMethodNote ?? null,
          amount_cents: parsed.data.amountCents ?? invoice.amount_cents,
          session_id: newSession.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId)
        .eq('workspace_id', coach.workspace_id)

      if (upErr) {
        return NextResponse.json(
          { error: upErr.message || 'Could not record payment' },
          { status: 500 }
        )
      }
    }

    const { data: invForPayment } = await supabase
      .from('session_invoices')
      .select('id, client_id, session_id, amount_cents')
      .eq('id', invoiceId)
      .eq('workspace_id', coach.workspace_id)
      .single()

    if (invForPayment) {
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('invoice_id', invoiceId)
        .maybeSingle()

      if (!existingPayment) {
        const amountFinal = parsed.data.amountCents ?? invForPayment.amount_cents
        const { error: payErr } = await supabase.from('payments').insert({
          workspace_id: coach.workspace_id,
          coach_id: user.id,
          client_id: invForPayment.client_id,
          invoice_id: invoiceId,
          session_id: invForPayment.session_id,
          amount_cents: amountFinal,
          currency: 'usd',
          payment_method: parsed.data.paymentMethod,
          payment_reference: parsed.data.paymentReference ?? null,
          notes: parsed.data.paymentMethodNote ?? null,
          payment_date: format(new Date(), 'yyyy-MM-dd'),
        })
        void payErr // best-effort row; invoice is already marked paid
      }
    }

    if (invoice.message_id) {
      const { data: inv } = await supabase
        .from('session_invoices')
        .select('amount_cents, currency, status, payment_method, paid_at')
        .eq('id', invoiceId)
        .single()

      const { data: msg } = await supabase
        .from('messages')
        .select('content')
        .eq('id', invoice.message_id)
        .single()

      if (msg?.content) {
        try {
          const payload = JSON.parse(msg.content) as Record<string, unknown>
          const updatedContent = JSON.stringify({
            ...payload,
            status: 'paid',
            amountCents: inv?.amount_cents ?? payload.amountCents,
            paymentMethod: inv?.payment_method ?? payload.paymentMethod,
            paidAt: inv?.paid_at ?? new Date().toISOString(),
          })
          await supabase
            .from('messages')
            .update({ content: updatedContent })
            .eq('id', invoice.message_id)
        } catch {
          // non-fatal: card will refetch from invoice API if needed
        }
      }
    }

    const { data: updated } = await supabase
      .from('session_invoices')
      .select('id, status, paid_at, payment_method, session_id')
      .eq('id', invoiceId)
      .single()

    void logAuditEvent(
      'invoice_paid',
      user.id,
      coach.workspace_id,
      { invoiceId },
      request
    )
    void invalidatePaymentSummaryCaches(coach.workspace_id)
    void invalidateCoachAnalyticsCaches(coach.workspace_id)

    return NextResponse.json({ data: updated })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
