import { NextResponse } from 'next/server'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'

/** No-op verification that admin POST routes respond; extend with real invalidation if needed. */
export async function POST(request: Request) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth
    await logAdminAudit({
      action: 'admin.refresh_settings',
      userId: auth.id,
      request,
    })
    return NextResponse.json({ data: { ok: true } })
  } catch {
    return NextResponse.json({ error: 'Could not refresh settings' }, { status: 500 })
  }
}
