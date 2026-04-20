import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

/**
 * GET /api/billing/founding-count
 * Returns how many founding-member subscriptions exist.
 * Public — no auth required (used on subscribe page before login).
 */
export async function GET() {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('plan', 'founding')
    .in('status', ['active', 'trialing'])

  if (error) {
    return NextResponse.json({ count: 0 })
  }

  return NextResponse.json({ count: count ?? 0 })
}
