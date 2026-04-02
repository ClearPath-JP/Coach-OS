import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { requireCoach } from '@/lib/api-helpers'
import { invalidateCoachAnalyticsCaches, invalidatePaymentSummaryCaches } from '@/lib/api-cache'
import { createPaymentSchema } from '@/lib/validations'
import { checkRateLimitAsync } from '@/lib/rate-limit'

const PAGE_SIZE = 20

/**
 * GET /api/payments — list payments for workspace. Coach only.
 * Query: clientId, startDate (YYYY-MM-DD), endDate, method, offset (default 0)
 */
export async function GET(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { workspaceId, supabase } = auth

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')?.trim()
    const startDate = searchParams.get('startDate')?.trim()
    const endDate = searchParams.get('endDate')?.trim()
    const method = searchParams.get('method')?.trim()
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0)

    let q = supabase
      .from('payments')
      .select(
        `
        id, workspace_id, coach_id, client_id, invoice_id, session_id,
        amount_cents, currency, payment_method, payment_reference, notes,
        payment_date, created_at, updated_at
      `
      )
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (clientId) q = q.eq('client_id', clientId)
    if (startDate) q = q.gte('payment_date', startDate)
    if (endDate) q = q.lte('payment_date', endDate)
    if (method) q = q.eq('payment_method', method)

    q = q.range(offset, offset + PAGE_SIZE - 1)

    const { data, error } = await q

    if (error) {
      return NextResponse.json(
        { error: 'Could not load payments' },
        { status: 500 }
      )
    }

    const rows = data ?? []
    return NextResponse.json({
      data: rows,
      hasMore: rows.length === PAGE_SIZE,
      nextOffset: offset + rows.length,
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/payments — record a payment. Coach only. Rate limit 60/min.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`api-payments-post:${user.id}`, {
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

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = createPaymentSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const {
      clientId,
      amountCents,
      paymentMethod,
      paymentReference,
      notes,
      paymentDate,
      invoiceId,
      sessionId,
    } = parsed.data

    const { data: clientRow, error: clientErr } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (clientErr || !clientRow) {
      return NextResponse.json({ error: 'Client not found in your workspace' }, { status: 404 })
    }

    if (invoiceId) {
      const { data: inv } = await supabase
        .from('session_invoices')
        .select('id, client_id')
        .eq('id', invoiceId)
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      if (!inv) {
        return NextResponse.json({ error: "We couldn't find that invoice" }, { status: 404 })
      }
      if (inv.client_id !== clientId) {
        return NextResponse.json({ error: 'Invoice does not match this client' }, { status: 400 })
      }
    }

    if (sessionId) {
      const { data: sess } = await supabase
        .from('sessions')
        .select('id, client_id')
        .eq('id', sessionId)
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      if (!sess) {
        return NextResponse.json({ error: "We couldn't find that session" }, { status: 404 })
      }
      if (sess.client_id !== clientId) {
        return NextResponse.json({ error: 'Session does not match this client' }, { status: 400 })
      }
    }

    const payDate = paymentDate ?? format(new Date(), 'yyyy-MM-dd')

    const { data: inserted, error: insErr } = await supabase
      .from('payments')
      .insert({
        workspace_id: workspaceId,
        coach_id: user.id,
        client_id: clientId,
        amount_cents: amountCents,
        currency: 'usd',
        payment_method: paymentMethod,
        payment_reference: paymentReference ?? null,
        notes: notes ?? null,
        payment_date: payDate,
        invoice_id: invoiceId ?? null,
        session_id: sessionId ?? null,
      })
      .select(
        `
        id, workspace_id, coach_id, client_id, invoice_id, session_id,
        amount_cents, currency, payment_method, payment_reference, notes,
        payment_date, created_at, updated_at
      `
      )
      .single()

    if (insErr) {
      return NextResponse.json(
        { error: 'Could not record payment' },
        { status: 500 }
      )
    }

    void invalidatePaymentSummaryCaches(workspaceId)
    void invalidateCoachAnalyticsCaches(workspaceId)

    return NextResponse.json({ data: inserted })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
