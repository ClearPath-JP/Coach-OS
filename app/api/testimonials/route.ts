import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimitAsync } from '@/lib/rate-limit'

/**
 * GET /api/testimonials — list workspace testimonials (newest first).
 *
 * Uses the service-role client (workspace-scoped after requireCoach) because the
 * testimonials RLS policies still subquery auth.users, which errors with
 * "permission denied for table users" for authenticated sessions
 * (same failure mode fixed for daily_checkins in 20260406000000).
 */
export async function GET() {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`testimonials-get:${user.id}`, {
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

    const svc = createServiceClient()
    const { data, error } = await svc
      .from('testimonials')
      .select(
        'id, workspace_id, client_id, client_name, content, rating, is_approved, is_public, source, created_at'
      )
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('GET /api/testimonials — query failed', error)
      return NextResponse.json({ error: 'Could not load testimonials' }, { status: 500 })
    }

    const shaped = (data ?? []).map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      clientId: r.client_id,
      clientName: r.client_name,
      content: r.content,
      rating: r.rating,
      isApproved: r.is_approved,
      isPublic: r.is_public,
      source: r.source,
      createdAt: r.created_at,
    }))

    return NextResponse.json({ data: shaped })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
