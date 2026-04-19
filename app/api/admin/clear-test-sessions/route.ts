import { NextResponse } from 'next/server'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/admin/clear-test-sessions
 * Cleans up stale sessions:
 * 1. Past pending/confirmed sessions → marked completed
 * 2. Optionally deletes ALL sessions if ?deleteAll=true
 */
export async function POST(request: Request) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth

    const service = createServiceClient()
    const { searchParams } = new URL(request.url)
    const deleteAll = searchParams.get('deleteAll') === 'true'

    if (deleteAll) {
      // Nuclear option: delete all sessions across all workspaces
      const { data, error } = await service
        .from('sessions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // delete all (neq trick)
        .select('id')

      await logAdminAudit({
        action: 'admin.clear_all_sessions',
        userId: auth.id,
        request,
        metadata: { deletedCount: data?.length ?? 0 },
      })

      return NextResponse.json({
        ok: true,
        message: `Deleted ${data?.length ?? 0} sessions`,
        error: error?.message ?? null,
      })
    }

    // Default: mark past pending/confirmed as completed
    const now = new Date().toISOString()
    const { data, error } = await service
      .from('sessions')
      .update({ status: 'completed' })
      .in('status', ['pending', 'confirmed'])
      .lt('scheduled_time', now)
      .select('id')

    await logAdminAudit({
      action: 'admin.clear_stale_sessions',
      userId: auth.id,
      request,
      metadata: { updatedCount: data?.length ?? 0 },
    })

    return NextResponse.json({
      ok: true,
      message: `Marked ${data?.length ?? 0} past sessions as completed`,
      error: error?.message ?? null,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
