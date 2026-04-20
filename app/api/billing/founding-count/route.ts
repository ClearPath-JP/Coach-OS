import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/billing/founding-count
 * Returns how many founding-member subscriptions exist.
 * Public — no auth required (used on subscribe page before login).
 * Uses a lightweight Supabase client without profile sync.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return NextResponse.json({ count: 0 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll() {},
    },
  })

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
