import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { updatePaymentSchema } from '@/lib/validations'
import { checkRateLimitAsync } from '@/lib/rate-limit'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/payments/[id] — update payment. Coach only.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`api-payments-patch:${user.id}`, {
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

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = updatePaymentSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('payments')
      .select('id, workspace_id, client_id')
      .eq('id', id)
      .maybeSingle()

    if (!existing || existing.workspace_id !== coach.workspace_id) {
      return NextResponse.json({ error: "We couldn't find that payment" }, { status: 404 })
    }

    const patch = parsed.data
    if (patch.clientId) {
      const { data: c } = await supabase
        .from('clients')
        .select('id')
        .eq('id', patch.clientId)
        .eq('workspace_id', coach.workspace_id)
        .maybeSingle()
      if (!c) {
        return NextResponse.json({ error: 'Client not found in your workspace' }, { status: 404 })
      }
    }

    const clientIdForLinks = patch.clientId ?? existing.client_id

    if (patch.invoiceId !== undefined && patch.invoiceId !== null) {
      const { data: inv } = await supabase
        .from('session_invoices')
        .select('client_id')
        .eq('id', patch.invoiceId)
        .eq('workspace_id', coach.workspace_id)
        .maybeSingle()
      if (!inv) {
        return NextResponse.json({ error: "We couldn't find that invoice" }, { status: 404 })
      }
      if (inv.client_id !== clientIdForLinks) {
        return NextResponse.json({ error: 'Invoice does not match this client' }, { status: 400 })
      }
    }

    if (patch.sessionId !== undefined && patch.sessionId !== null) {
      const { data: sess } = await supabase
        .from('sessions')
        .select('client_id')
        .eq('id', patch.sessionId)
        .eq('workspace_id', coach.workspace_id)
        .maybeSingle()
      if (!sess) {
        return NextResponse.json({ error: "We couldn't find that session" }, { status: 404 })
      }
      if (sess.client_id !== clientIdForLinks) {
        return NextResponse.json({ error: 'Session does not match this client' }, { status: 400 })
      }
    }

    const updateRow: Record<string, unknown> = {}
    if (patch.clientId !== undefined) updateRow.client_id = patch.clientId
    if (patch.amountCents !== undefined) updateRow.amount_cents = patch.amountCents
    if (patch.paymentMethod !== undefined) updateRow.payment_method = patch.paymentMethod
    if (patch.paymentReference !== undefined) updateRow.payment_reference = patch.paymentReference
    if (patch.notes !== undefined) updateRow.notes = patch.notes
    if (patch.paymentDate !== undefined) updateRow.payment_date = patch.paymentDate
    if (patch.invoiceId !== undefined) updateRow.invoice_id = patch.invoiceId
    if (patch.sessionId !== undefined) updateRow.session_id = patch.sessionId

    if (Object.keys(updateRow).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('payments')
      .update(updateRow)
      .eq('id', id)
      .eq('workspace_id', coach.workspace_id)
      .select(
        `
        id, workspace_id, coach_id, client_id, invoice_id, session_id,
        amount_cents, currency, payment_method, payment_reference, notes,
        payment_date, created_at, updated_at,
        clients(first_name, last_name)
      `
      )
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not update payment' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: updated })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/payments/[id] — hard delete. Coach only.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: existing } = await supabase
      .from('payments')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', coach.workspace_id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: "We couldn't find that payment" }, { status: 404 })
    }

    const { error } = await supabase.from('payments').delete().eq('id', id).eq('workspace_id', coach.workspace_id)

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Could not delete payment' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: { id } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
