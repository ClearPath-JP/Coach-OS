import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'

/**
 * DELETE /api/coach/leads/[id] — delete one lead search row.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`leads-delete:${user.id}`, {
      windowMs: 60_000,
      max: 30,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many requests — please wait a minute' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: existing } = await supabase
      .from('lead_searches')
      .select('id, workspace_id')
      .eq('id', id)
      .maybeSingle()
    if (!existing || existing.workspace_id !== workspaceId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { error } = await supabase.from('lead_searches').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: 'Could not delete search' }, { status: 500 })
    }
    return NextResponse.json({ data: 'ok' })
  } catch (err) {
    console.error('DELETE /api/coach/leads/[id]', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
