import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logServerError } from '@/lib/log-server-error'
import { signBunnyUrl, bunnyEmbedUrl } from '@/lib/bunny'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Studio: dispatch due scheduled_posts (mode='share').
 * Called by n8n on a ~10 min schedule.
 * Finds posts that are due, emails the coach a "time to post" reminder
 * (video link + caption), then marks the post status='reminded'.
 * Protected by CRON_SECRET (send as Authorization: Bearer <secret>).
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function handler(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ data: { skipped: 'email not configured' } })
  }

  const service = createServiceClient()

  const nowIso = new Date().toISOString()
  const { data: due } = await service
    .from('scheduled_posts')
    .select('id, workspace_id, coach_id, video_id, platforms, caption, scheduled_at, mode')
    .eq('status', 'scheduled')
    .eq('mode', 'share')
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(50)

  if (!due || due.length === 0) {
    return NextResponse.json({ data: { processed: 0, failed: 0 } })
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM_DEFAULT?.trim() || 'ClearPath <onboarding@resend.dev>'

  let processed = 0
  let failed = 0

  for (const post of due) {
    try {
      // Load the video row — scoped to the workspace for safety.
      const { data: video } = await service
        .from('videos')
        .select('id, title, mp4_url, playback_url, thumbnail_url, bunny_video_guid, bunny_library_id')
        .eq('id', post.video_id)
        .eq('workspace_id', post.workspace_id)
        .maybeSingle()

      if (!video) {
        const { error: updateErr } = await service
          .from('scheduled_posts')
          .update({ status: 'failed', error: 'video missing' })
          .eq('id', post.id)
        if (updateErr) console.error('[studio/dispatch-due] failed to mark video-missing', post.id, updateErr)
        failed++
        continue
      }

      // Resolve the coach's email — exact pattern from coach-activity-email.ts.
      const { data: profile } = await service
        .from('profiles')
        .select('email')
        .eq('id', post.coach_id)
        .maybeSingle()

      const coachEmail = (profile?.email ?? '').trim()
      if (!coachEmail) {
        const { error: updateErr } = await service
          .from('scheduled_posts')
          .update({ status: 'failed', error: 'no coach email' })
          .eq('id', post.id)
        if (updateErr) console.error('[studio/dispatch-due] failed to mark no-email', post.id, updateErr)
        failed++
        continue
      }

      // Build the best available video link.
      let videoLink: string
      if (video.mp4_url) {
        videoLink = signBunnyUrl(video.mp4_url)
      } else if (video.bunny_video_guid) {
        videoLink = bunnyEmbedUrl(video.bunny_video_guid, video.bunny_library_id) ?? (video.playback_url ?? '')
      } else {
        videoLink = video.playback_url ?? ''
      }

      const videoTitle = escapeHtml((video.title ?? 'your reel').trim())
      const platforms: string[] = Array.isArray(post.platforms) ? post.platforms : []
      const platformLabel = platforms.length > 0 ? platforms.join(', ') : 'your chosen platform'
      const caption = (post.caption ?? '').trim()

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <h2 style="margin-bottom: 4px;">Time to post!</h2>
          <p style="margin-top: 0; color: #555;">
            Your scheduled clip is ready to post on <strong>${escapeHtml(platformLabel)}</strong>.
          </p>

          <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
            <tr>
              <td style="padding: 12px 16px; background: #f5f5f5; border-radius: 8px;">
                <strong style="display: block; margin-bottom: 6px;">Clip</strong>
                <a href="${escapeHtml(videoLink)}" style="color: #c8882e; text-decoration: none;">
                  ${videoTitle} &rarr;
                </a>
              </td>
            </tr>
          </table>

          ${caption ? `
          <div style="margin-bottom: 20px;">
            <strong style="display: block; margin-bottom: 8px;">Caption</strong>
            <div style="
              background: #f9f8f6;
              border-left: 3px solid #c8882e;
              padding: 12px 16px;
              border-radius: 0 8px 8px 0;
              font-size: 14px;
              line-height: 1.6;
              white-space: pre-wrap;
            ">${escapeHtml(caption)}</div>
          </div>
          ` : ''}

          <p style="font-size: 12px; color: #999; margin-top: 32px;">
            Sent by Kindo &mdash; your coaching studio
          </p>
        </div>
      `

      // Strip CRLF from subject to prevent email header injection.
      const safeTitle = (video.title?.trim() || 'your reel').replace(/[\r\n]+/g, ' ')

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [coachEmail],
          subject: `Time to post: ${safeTitle}`,
          html,
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error('[studio/dispatch-due] resend failed', post.id, res.status, text)
        // Do not mark failed — a transient Resend error shouldn't strand the post.
        // Leave status='scheduled' so the next cron pass retries.
        continue
      }

      await service
        .from('scheduled_posts')
        .update({ status: 'reminded', posted_at: new Date().toISOString() })
        .eq('id', post.id)

      processed++
    } catch (err) {
      console.error('[studio/dispatch-due] post', post.id, err)
      failed++
    }
  }

  return NextResponse.json({ data: { processed, failed } })
}

export async function GET(request: Request) {
  try {
    return await handler(request)
  } catch (err) {
    logServerError('GET /api/studio/dispatch-due', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}
