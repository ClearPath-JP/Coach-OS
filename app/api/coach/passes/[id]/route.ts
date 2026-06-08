import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { patchClassPassSchema } from '@/lib/validations'

interface ClassPass {
  id: string
  workspace_id: string
  coach_id: string
  title: string
  description: string | null
  price_cents: number
  currency: string
  credit_count: number
  applies_to: string
  applies_to_types: string[] | null
  expires_in_days: number | null
  status: string
  created_at: string
  updated_at: string
}

type ResolvedPass =
  | { pass: ClassPass; svc: ReturnType<typeof createServiceClient> }
  | { notFound: true }
  | { forbidden: true }

async function resolvePass(passId: string, workspaceId: string, userId: string): Promise<ResolvedPass> {
  const svc = createServiceClient()
  const { data: raw, error } = await svc.from('class_passes').select('*').eq('id', passId).maybeSingle()
  if (error || !raw) return { notFound: true }
  const pass = raw as unknown as ClassPass
  if (pass.workspace_id !== workspaceId || pass.coach_id !== userId) return { forbidden: true }
  return { pass, svc }
}

/** PATCH /api/coach/passes/[id] — edit a pass. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: passId } = await params
    if (!passId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`passes-patch:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json()
    const parsed = patchClassPassSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })
    }

    const resolved = await resolvePass(passId, workspaceId, user.id)
    if ('notFound' in resolved) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if ('forbidden' in resolved) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { svc } = resolved
    const d = parsed.data

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (d.title !== undefined) updates.title = d.title
    if (d.description !== undefined) updates.description = d.description ?? null
    if (d.priceCents !== undefined) updates.price_cents = d.priceCents
    if (d.currency !== undefined) updates.currency = d.currency
    if (d.creditCount !== undefined) updates.credit_count = d.creditCount
    if (d.appliesTo !== undefined) updates.applies_to = d.appliesTo
    if (d.appliesToTypes !== undefined) updates.applies_to_types = d.appliesToTypes ?? null
    if (d.expiresInDays !== undefined) updates.expires_in_days = d.expiresInDays ?? null
    if (d.status !== undefined) updates.status = d.status

    const { data: rawUpdated, error: updateErr } = await svc
      .from('class_passes')
      .update(updates)
      .eq('id', passId)
      .select('*')
      .single()

    if (updateErr || !rawUpdated) {
      console.error('PATCH /api/coach/passes/[id] — update', updateErr)
      return NextResponse.json({ error: 'Could not update pass' }, { status: 500 })
    }
    return NextResponse.json({ data: rawUpdated as unknown as ClassPass })
  } catch (e) {
    console.error('PATCH /api/coach/passes/[id]', e)
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}

/** DELETE /api/coach/passes/[id] — soft-archive (existing client balances keep working). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: passId } = await params
    if (!passId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`passes-delete:${user.id}`, {
      windowMs: 60_000,
      max: 30,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests — try again shortly' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const resolved = await resolvePass(passId, workspaceId, user.id)
    if ('notFound' in resolved) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if ('forbidden' in resolved) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { pass, svc } = resolved

    if (pass.status === 'archived') {
      return NextResponse.json({ error: 'Pass is already archived' }, { status: 409 })
    }

    const { error: archiveErr } = await svc
      .from('class_passes')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', passId)

    if (archiveErr) {
      console.error('DELETE /api/coach/passes/[id] — archive', archiveErr)
      return NextResponse.json({ error: 'Could not archive pass' }, { status: 500 })
    }
    return NextResponse.json({ data: { id: passId, status: 'archived' } })
  } catch (e) {
    console.error('DELETE /api/coach/passes/[id]', e)
    return NextResponse.json({ error: 'Something went wrong — try again' }, { status: 500 })
  }
}
