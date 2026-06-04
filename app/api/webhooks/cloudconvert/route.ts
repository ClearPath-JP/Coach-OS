import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchCloudConvertJob, finalizeFromCloudConvertJobId } from '@/lib/drive-import/cloudconvert-finalize'
import { logServerError } from '@/lib/log-server-error'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i


function verifyCloudConvertSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.CLOUDCONVERT_WEBHOOK_SECRET?.trim()
  if (!secret || !signatureHeader) return false
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  try {
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(signatureHeader.trim(), 'hex')
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

type CcTask = {
  operation?: string
  status?: string
  result?: { files?: Array<{ url?: string }> }
}

type CcJobData = {
  id?: string
  tag?: string
  status?: string
  tasks?: CcTask[]
}

/**
 * POST /api/webhooks/cloudconvert
 *
 * **With CLOUDCONVERT_WEBHOOK_SECRET:** validates HMAC (account webhook in CloudConvert dashboard).
 * **Without HMAC:** requires `X-Clearpath-Secret` = `N8N_CALLBACK_SECRET`, `job.id` in JSON body,
 * and re-fetches the job from CloudConvert (per-job webhooks without account signing secret).
 */
export async function POST(request: Request) {
  const rawBody = await request.text()
  const webhookSecret = process.env.CLOUDCONVERT_WEBHOOK_SECRET?.trim()
  const signatureHeader = request.headers.get('CloudConvert-Signature')
  const n8nSecret = process.env.N8N_CALLBACK_SECRET?.trim()
  const headerSecret = (
    request.headers.get('x-clearpath-secret') ??
    request.headers.get('X-Clearpath-Secret') ??
    ''
  ).trim()

  // Determine auth path. Every request must pass at least one real secret check.
  // Path 1: CLOUDCONVERT_WEBHOOK_SECRET is set AND the signature header is present → verify HMAC.
  // Path 2: N8N_CALLBACK_SECRET is set AND X-Clearpath-Secret header matches → accept.
  // Anything else (no secret configured, or no credential presented) → 401.
  const useHmac = Boolean(webhookSecret && signatureHeader)

  if (useHmac) {
    // HMAC path — used by production account-wide webhooks.
    const signatureValid = verifyCloudConvertSignature(rawBody, signatureHeader)
    if (!signatureValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  } else {
    // Fallback path — per-job webhook_url callbacks (no CloudConvert signature).
    // Requires N8N_CALLBACK_SECRET to be configured and the header to match.
    // Hash both through HMAC-SHA256 with a fixed key so the buffers are always
    // 32 bytes regardless of input length — no early-exit timing leak.
    if (!n8nSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const hmacKey = Buffer.from('kindo-webhook-compare')
    const expected = createHmac('sha256', hmacKey).update(n8nSecret, 'utf8').digest()
    const actual   = createHmac('sha256', hmacKey).update(headerSecret, 'utf8').digest()
    let secretMatch = false
    try {
      secretMatch = timingSafeEqual(expected, actual)
    } catch {
      secretMatch = false
    }
    if (!secretMatch) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let event: string
  let job: CcJobData
  try {
    const json = JSON.parse(rawBody) as { event?: string; job?: CcJobData }
    event = json.event ?? ''
    job = json.job ?? {}
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!useHmac) {
    // Per-job path: re-fetch job state from CloudConvert to confirm it is real.
    const jobId = job.id
    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ error: 'job.id required in webhook body' }, { status: 400 })
    }
    const remote = await fetchCloudConvertJob(jobId)
    if (!remote) {
      return NextResponse.json({ error: 'Could not load job from CloudConvert' }, { status: 502 })
    }
    job = remote
    if (remote.status === 'error') {
      event = 'job.failed'
    } else if (remote.status === 'finished') {
      event = 'job.finished'
    } else {
      return NextResponse.json({ ok: true, pending: true })
    }
  }

  const tag = (job.tag ?? '').trim()
  if (!uuidRe.test(tag)) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const supabase = createServiceClient()

  if (event === 'job.failed') {
    await supabase
      .from('videos')
      .update({
        processing_status: 'failed',
        processing_error: 'CloudConvert job failed',
      })
      .eq('id', tag)
      .eq('processing_status', 'processing')
    return NextResponse.json({ ok: true })
  }

  if (event !== 'job.finished') {
    return NextResponse.json({ ok: true })
  }
  if (!job.id || typeof job.id !== 'string') {
    return NextResponse.json({ error: 'Missing CloudConvert job id' }, { status: 400 })
  }
  const result = await finalizeFromCloudConvertJobId({
    supabase,
    videoId: tag,
    jobId: job.id,
  })
  if (result.state === 'failed') {
    return NextResponse.json({ error: 'Could not finalize video processing. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, state: result.state })
}
