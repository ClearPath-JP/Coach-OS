import { NextResponse } from 'next/server'
import { applyAuthNoStoreHeaders } from '@/lib/auth-response'
import { createClient } from '@/lib/supabase-server'

/**
 * POST /api/auth/dev-clear-session — development only. Signs out and clears auth cookies
 * so you can test login flows and role switching without a private window.
 */
export async function POST() {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const supabase = await createClient()
    await supabase.auth.signOut()
    return applyAuthNoStoreHeaders(NextResponse.json({ data: { ok: true } }))
  } catch (error) {
    console.error('[POST /api/auth/dev-clear-session]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
