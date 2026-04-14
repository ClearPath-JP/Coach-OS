import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import crypto from 'crypto'

// ---------------------------------------------------------------------------
// GET /api/settings/domain — return the current domain for this workspace
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
    if (!workspaceId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('coach_domains')
      .select(
        'id, domain, status, verification_token, verification_method, last_checked_at, error_message, ssl_status, domain_verified, requested_at'
      )
      .eq('workspace_id', workspaceId)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: 'Could not load domain settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data ?? null })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/settings/domain — save or update the custom domain
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
    if (!workspaceId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { success, retryAfter } = await checkRateLimitAsync(
      `settings-domain:${user.id}`,
      { windowMs: 60 * 1000, max: 10 }
    )
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json().catch(() => null)
    const rawDomain = typeof body?.domain === 'string' ? body.domain.trim().toLowerCase() : ''

    // Basic domain validation: no protocol, no path, looks like a hostname
    const domainPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/
    if (!rawDomain || !domainPattern.test(rawDomain)) {
      return NextResponse.json(
        { error: 'Enter a valid domain (e.g. app.yourbrand.com)' },
        { status: 400 }
      )
    }

    // Check if this workspace already has a domain row
    const { data: existing } = await supabase
      .from('coach_domains')
      .select('id')
      .eq('workspace_id', workspaceId)
      .limit(1)
      .maybeSingle()

    const verificationToken = crypto.randomBytes(16).toString('hex')

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('coach_domains')
        .update({
          domain: rawDomain,
          status: 'pending_verification',
          verification_token: verificationToken,
          verification_method: 'dns_txt',
          domain_verified: false,
          ssl_status: 'not_started',
          error_message: null,
          last_checked_at: null,
        })
        .eq('id', existing.id)
        .select(
          'id, domain, status, verification_token, verification_method, last_checked_at, error_message, ssl_status, domain_verified, requested_at'
        )
        .single()

      if (error) {
        return NextResponse.json(
          { error: 'Could not update domain' },
          { status: 500 }
        )
      }

      return NextResponse.json({ data })
    }

    // Insert new record
    const { data, error } = await supabase
      .from('coach_domains')
      .insert({
        coach_id: user.id,
        workspace_id: workspaceId,
        domain: rawDomain,
        status: 'pending_verification',
        verification_token: verificationToken,
        verification_method: 'dns_txt',
        domain_verified: false,
        ssl_status: 'not_started',
      })
      .select(
        'id, domain, status, verification_token, verification_method, last_checked_at, error_message, ssl_status, domain_verified, requested_at'
      )
      .single()

    if (error) {
      // Unique constraint on domain column — someone else has this domain
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This domain is already registered to another workspace' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: 'Could not save domain' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
