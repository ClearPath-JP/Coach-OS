import { NextResponse } from 'next/server'

/**
 * GET /api/health — liveness for uptime monitors; no auth.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
}
