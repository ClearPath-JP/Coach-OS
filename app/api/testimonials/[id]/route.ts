import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { patchTestimonialSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth
    const { id } = await context.params

    const { success, retryAfter } = await checkRateLimitAsync(`testimonials-patch:${user.id}`, {
      windowMs: 60_000,
      max: 120,
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
    const parsed = patchTestimonialSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const patch: Record<string, unknown> = {}
    if (parsed.data.isApproved !== undefined) patch.is_approved = parsed.data.isApproved
    if (parsed.data.isPublic !== undefined) patch.is_public = parsed.data.isPublic

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data: row, error } = await supabase
      .from('testimonials')
      .update(patch)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(
        'id, workspace_id, client_id, client_name, content, rating, is_approved, is_public, source, created_at'
      )
      .maybeSingle()

    if (error || !row) {
      return NextResponse.json({ error: "We couldn't find that testimonial" }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        id: row.id,
        workspaceId: row.workspace_id,
        clientId: row.client_id,
        clientName: row.client_name,
        content: row.content,
        rating: row.rating,
        isApproved: row.is_approved,
        isPublic: row.is_public,
        source: row.source,
        createdAt: row.created_at,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth
    const { id } = await context.params

    const { success, retryAfter } = await checkRateLimitAsync(`testimonials-del:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: existing } = await supabase
      .from('testimonials')
      .select('id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (!existing) {
      return NextResponse.json({ error: "We couldn't find that testimonial" }, { status: 404 })
    }

    const { error: delErr } = await supabase.from('testimonials').delete().eq('id', id)
    if (delErr) {
      return NextResponse.json({ error: 'Could not delete testimonial' }, { status: 500 })
    }
    return NextResponse.json({ data: { ok: true } })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
