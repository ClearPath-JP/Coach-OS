import { NextResponse } from 'next/server'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import { clearApplicationDataCaches } from '@/lib/api-cache'

export async function POST(request: Request) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth
    await clearApplicationDataCaches()
    await logAdminAudit({
      action: 'admin.cache.clear',
      userId: auth.id,
      request,
    })
    return NextResponse.json({ data: { ok: true } })
  } catch {
    return NextResponse.json({ error: 'Could not clear cache' }, { status: 500 })
  }
}
