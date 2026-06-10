import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/billing/founding-count
 * Returns how many founding-member subscriptions exist.
 * Public — no auth required (used on subscribe page before login).
 *
 * Uses the service-role client: RLS only lets workspace members SELECT
 * subscriptions, so an anon/session count would always return 0 and the
 * subscribe page would show "10 of 10 spots left" forever. Only an
 * aggregate count is exposed — no row data leaves the server.
 */
export async function GET() {
  try {
    const supabase = createServiceClient()

    const { count, error } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('plan', 'founding')
      .in('status', ['active', 'trialing'])

    if (error) {
      return NextResponse.json({ count: 0 })
    }

    return NextResponse.json({ count: count ?? 0 })
  } catch {
    // createServiceClient throws when env vars are missing — keep the public
    // endpoint soft-failing with the same response shape.
    return NextResponse.json({ count: 0 })
  }
}
