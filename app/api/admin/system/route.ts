import { NextResponse } from 'next/server'
import { assertAdminApi, logAdminAudit } from '@/lib/admin'
import { healthErrorMessage } from '@/lib/admin-audit-messages'
import { runAdminHealthSummary } from '@/lib/admin-health-summary'
import { createServiceClient } from '@/lib/supabase/service'

const SLOW_MS = 500

export async function GET(request: Request) {
  try {
    const auth = await assertAdminApi(request)
    if (auth instanceof NextResponse) return auth
    const service = createServiceClient()
    const { searchParams } = new URL(request.url)

    const snap = await runAdminHealthSummary(service)

    if (searchParams.get('summary') === '1') {
      return NextResponse.json({
        data: {
          checkedAt: snap.checkedAt,
          platformHealthOk: snap.platformHealthOk,
          failing: snap.failing,
          slow: snap.slow,
        },
      })
    }

    function healthEntry(key: string, ok: boolean, ms: number): {
      ok: boolean
      ms: number
      slow: boolean
      status: 'healthy' | 'error' | 'slow'
      message: string | null
    } {
      const slow = ok && ms > SLOW_MS
      const status: 'healthy' | 'error' | 'slow' = !ok ? 'error' : slow ? 'slow' : 'healthy'
      return {
        ok,
        ms,
        slow,
        status,
        message: healthErrorMessage(key, ok, ms),
      }
    }

    const health = {
      database: healthEntry('database', snap.services.database!.ok, snap.services.database!.ms),
      auth: healthEntry('auth', snap.services.auth!.ok, snap.services.auth!.ms),
      storage: healthEntry('storage', snap.services.storage!.ok, snap.services.storage!.ms),
      redis: healthEntry('redis', snap.services.redis!.ok, snap.services.redis!.ms),
      stripe: healthEntry('stripe', snap.services.stripe!.ok, snap.services.stripe!.ms),
      resend: healthEntry('resend', snap.services.resend!.ok, snap.services.resend!.ms),
    }

    const checkedAt = snap.checkedAt

    const [messages, sessions, programs, videos, payments, clients, coaches] = await Promise.all([
      service.from('messages').select('id', { count: 'exact', head: true }),
      service.from('sessions').select('id', { count: 'exact', head: true }),
      service.from('programs').select('id', { count: 'exact', head: true }),
      service.from('videos').select('id', { count: 'exact', head: true }),
      service.from('payments').select('id', { count: 'exact', head: true }),
      service.from('clients').select('id', { count: 'exact', head: true }),
      service.from('coaches').select('id', { count: 'exact', head: true }),
    ])

    const { data: videoBytes } = await service.from('videos').select('file_size_bytes')
    const videoStorageBytes = (videoBytes ?? []).reduce((s, v) => s + (v.file_size_bytes ?? 0), 0)
    const videoFileCount = videoBytes?.length ?? 0

    let assignmentStorageBytes = 0
    try {
      const { data: assignmentBytes } = await service
        .from('assignment_submissions')
        .select('file_size_bytes')
        .not('file_size_bytes', 'is', null)
      assignmentStorageBytes = (assignmentBytes ?? []).reduce((s, r) => s + (r.file_size_bytes ?? 0), 0)
    } catch {
      assignmentStorageBytes = 0
    }

    const totalPlatformBytes = videoStorageBytes + assignmentStorageBytes

    const logs = await service
      .from('audit_logs')
      .select('action,user_id,ip_address,created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    const googleOAuthConfigured = !!(
      process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()
    )
    const n8nPipelineConfigured = !!(
      process.env.N8N_CALLBACK_SECRET?.trim() ||
      process.env.N8N_SESSION_BOOKED_WEBHOOK_URL?.trim() ||
      process.env.N8N_VIDEO_WEBHOOK_SECRET?.trim()
    )

    await logAdminAudit({
      action: 'admin.system.read',
      userId: auth.id,
      request,
    })

    return NextResponse.json({
      data: {
        checkedAt,
        health,
        integrations: {
          googleOAuth: googleOAuthConfigured,
          n8nPipeline: n8nPipelineConfigured,
        },
        stats: {
          rows: {
            messages: messages.count ?? 0,
            sessions: sessions.count ?? 0,
            programs: programs.count ?? 0,
            videos: videos.count ?? 0,
            payments: payments.count ?? 0,
            clients: clients.count ?? 0,
            coaches: coaches.count ?? 0,
          },
          totalPlatformBytes,
          videoStorageBytes,
          assignmentStorageBytes,
          fileStorageBytes: 0,
          videoFileCount,
          nextVersion: '16.x',
          nodeVersion: process.version,
        },
        auditLogs: logs.data ?? [],
      },
    })
  } catch {
    return NextResponse.json({ error: 'Could not load system data' }, { status: 500 })
  }
}
