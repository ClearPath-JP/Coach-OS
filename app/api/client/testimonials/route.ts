import { NextResponse } from 'next/server'
import { requireClient } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { clientTestimonialSubmitSchema } from '@/lib/validations'

/**
 * POST /api/client/testimonials — submit a review (pending coach approval).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireClient()
    if ('error' in auth) return auth.error
    const { clientId, workspaceId, supabase, user } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`client-testimonials:${user.id}`, {
      windowMs: 60_000,
      max: 20,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json()
    const parsed = clientTestimonialSubmitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const { data: cl, error: cErr } = await supabase
      .from('clients')
      .select('id, first_name, last_name')
      .eq('id', clientId)
      .maybeSingle()
    if (cErr || !cl) {
      return NextResponse.json({ error: "We couldn't save your review" }, { status: 400 })
    }

    const clientName =
      [cl.first_name, cl.last_name].filter(Boolean).join(' ').trim() || 'Client'
    const text = (parsed.data.content ?? '').trim().slice(0, 500)

    const { data: row, error: insErr } = await supabase
      .from('testimonials')
      .insert({
        workspace_id: workspaceId,
        client_id: clientId,
        client_name: clientName,
        content: text || '—',
        rating: parsed.data.rating,
        is_approved: false,
        is_public: false,
        source: 'in_app',
      })
      .select('id, created_at')
      .single()

    if (insErr || !row) {
      return NextResponse.json({ error: 'Could not save your review' }, { status: 500 })
    }

    return NextResponse.json({
      data: { id: row.id, createdAt: row.created_at },
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
