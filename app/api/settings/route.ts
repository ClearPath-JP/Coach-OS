import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/settings
 * Returns merged workspace + profile settings for the signed-in coach.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { success, retryAfter } = await checkRateLimitAsync(`settings-get:${user.id}`, {
      windowMs: 60_000,
      max: 100,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: coach } = await supabase
      .from('coaches')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!coach?.workspace_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [{ data: workspace, error: workspaceError }, { data: profile, error: profileError }] = await Promise.all([
      supabase
        .from('workspaces')
        .select('id, name, workspace_display_name, logo_url, timezone, accent_color, accent_color_light, preferred_payment_methods, public_booking_enabled, brand_name, brand_tagline, client_portal_heading, client_welcome_message, completed_onboarding')
        .eq('id', coach.workspace_id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select(
          'role, full_name, bio, phone, logo_url, notification_new_message, notification_session_reminder, notification_client_activity, notification_payment_received'
        )
        .eq('id', user.id)
        .maybeSingle(),
    ])

    if (profile?.role !== 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (workspaceError || profileError) {
      return NextResponse.json(
        { error: workspaceError?.message || profileError?.message || 'Could not load settings' },
        { status: 500 }
      )
    }

    const prof = profile as {
      role?: string | null
      full_name?: string | null
      bio?: string | null
      phone?: string | null
      logo_url?: string | null
      notification_new_message?: boolean | null
      notification_session_reminder?: boolean | null
      notification_client_activity?: boolean | null
      notification_payment_received?: boolean | null
    } | null

    const fullName = prof?.full_name?.trim() ?? ''
    const [firstName, ...rest] = fullName.split(' ').filter(Boolean)
    const lastName = rest.join(' ')

    return NextResponse.json({
      data: {
        workspace: {
          id: workspace?.id ?? coach.workspace_id,
          name: workspace?.name ?? null,
          displayName: workspace?.workspace_display_name ?? null,
          logoUrl: workspace?.logo_url ?? null,
          timezone: workspace?.timezone ?? 'America/New_York',
          accentColor: workspace?.accent_color ?? null,
          accentColorLight: workspace?.accent_color_light ?? null,
          preferredPaymentMethods: workspace?.preferred_payment_methods ?? [],
          publicBookingEnabled: workspace?.public_booking_enabled ?? false,
          brandName: workspace?.brand_name ?? null,
          brandTagline: workspace?.brand_tagline ?? null,
          clientPortalHeading: workspace?.client_portal_heading ?? null,
          clientWelcomeMessage: workspace?.client_welcome_message ?? null,
          completedOnboarding: workspace?.completed_onboarding ?? false,
        },
        profile: {
          firstName: firstName ?? '',
          lastName: lastName ?? '',
          fullName: fullName || null,
          bio: prof?.bio ?? null,
          phone: prof?.phone ?? null,
          avatarUrl: prof?.logo_url ?? null,
          email: user.email ?? null,
          notifications: {
            newMessage: prof?.notification_new_message ?? true,
            sessionReminder: prof?.notification_session_reminder ?? true,
            clientActivity: prof?.notification_client_activity ?? true,
            paymentReceived: prof?.notification_payment_received ?? true,
          },
        },
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
