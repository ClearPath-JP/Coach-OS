import { NextResponse } from 'next/server'

/**
 * GET /api/health — liveness for uptime monitors; no auth.
 * public-ok: intentionally unauthenticated
 */
export async function GET() {
  try {
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[GET /api/health]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
