import { NextResponse } from 'next/server'

/**
 * GET /api/health — liveness for uptime monitors; no auth.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  })
}
