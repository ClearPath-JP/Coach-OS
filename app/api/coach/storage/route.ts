import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { PLAN_LIMITS } from '@/lib/plan-limits'
import { createServiceClient } from '@/lib/supabase/service'

/** GET /api/coach/storage — usage vs plan cap (videos + assignment files). */
export async function GET() {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId } = auth

    const { success: rateOk, retryAfter } = await checkRateLimitAsync(`coach-storage:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!rateOk) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 })
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const service = createServiceClient()
    const { data: sub } = await service
      .from('subscriptions')
      .select('plan')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    const planKey = sub?.plan ?? 'free'
    const limits = PLAN_LIMITS[planKey as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free
    const maxGb = limits.maxVideoStorageGb + limits.maxAssignmentStorageGb

    const { data: ws } = await service
      .from('workspaces')
      .select('storage_used_bytes')
      .eq('id', workspaceId)
      .maybeSingle()

    const { data: vids } = await service
      .from('videos')
      .select('file_size_bytes')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
    const videoBytes = (vids ?? []).reduce((s, v) => s + (v.file_size_bytes ?? 0), 0)

    const { data: subs } = await service
      .from('assignment_submissions')
      .select('file_size_bytes')
      .eq('workspace_id', workspaceId)
    const assignmentBytes = (subs ?? []).reduce((s, v) => s + (v.file_size_bytes ?? 0), 0)

    const tracked = ws?.storage_used_bytes ?? videoBytes + assignmentBytes
    const otherBytes = Math.max(0, Number(tracked) - videoBytes - assignmentBytes)

    return NextResponse.json({
      data: {
        usedBytes: tracked,
        videoBytes,
        assignmentBytes,
        otherBytes,
        maxGb,
        videoMaxGb: limits.maxVideoStorageGb,
        assignmentMaxGb: limits.maxAssignmentStorageGb,
        usedGb: tracked / 1_000_000_000,
        pct: maxGb > 0 ? Math.min(100, Math.round((tracked / (maxGb * 1_000_000_000)) * 100)) : 0,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
