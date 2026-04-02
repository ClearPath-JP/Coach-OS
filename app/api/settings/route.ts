import { NextResponse } from 'next/server'
import { settingsCacheKey, withCache } from '@/lib/api-cache'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

type SettingsPayload = {
  workspace: {
    id: string
    name: unknown
    displayName: unknown
    logoUrl: unknown
    timezone: unknown
    accentColor: unknown
    accentColorLight: unknown
    preferredPaymentMethods: unknown
    publicBookingEnabled: unknown
    autoCheckinEnabled: unknown
    autoCheckinMessage: unknown
    brandName: unknown
    brandTagline: unknown
    clientPortalHeading: unknown
    clientWelcomeMessage: unknown
    completedOnboarding: unknown
    cashappUsername: unknown
    venmoUsername: unknown
    paypalEmail: unknown
    zelleEmailOrPhone: unknown
    stripeConnected: unknown
    paymentInstructions: unknown
  }
  profile: {
    firstName: string
    lastName: string
    fullName: string | null
    bio: unknown
    phone: unknown
    avatarUrl: string | null
    email: string | null
    notifications: {
      newMessage: boolean
      sessionReminder: boolean
      clientActivity: boolean
      paymentReceived: boolean
    }
  }
}

type SettingsCacheResult =
  | { ok: true; data: SettingsPayload }
  | { ok: false; error: 'forbidden' | 'load_failed' }

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

    const workspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
    if (!workspaceId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await withCache(settingsCacheKey(workspaceId, user.id), 60, async (): Promise<SettingsCacheResult> => {
      let workspaceColumns =
        'id, name, workspace_display_name, logo_url, timezone, accent_color, accent_color_light, preferred_payment_methods, public_booking_enabled, auto_checkin_enabled, auto_checkin_message, brand_name, brand_tagline, client_portal_heading, client_welcome_message, completed_onboarding, cashapp_username, venmo_username, paypal_email, zelle_email_or_phone, stripe_connected, payment_instructions'
      const [{ data: workspaceFull, error: workspaceFullError }, { data: profile, error: profileError }] =
        await Promise.all([
          supabase
            .from('workspaces')
            .select(workspaceColumns)
            .eq('id', workspaceId)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select(
              'role, full_name, bio, phone, logo_url, notification_new_message, notification_session_reminder, notification_client_activity, notification_payment_received'
            )
            .eq('id', user.id)
            .maybeSingle(),
        ])

      const { data: coachProfile } = await supabase
        .from('coach_profiles')
        .select('profile_image_url')
        .eq('coach_id', user.id)
        .maybeSingle()
      let workspace = workspaceFull as Record<string, unknown> | null
      let workspaceError = workspaceFullError as { message?: string } | null
      if (workspaceFullError?.message?.includes('does not exist')) {
        workspaceColumns =
          'id, name, workspace_display_name, logo_url, timezone, accent_color, accent_color_light, preferred_payment_methods, public_booking_enabled, auto_checkin_enabled, auto_checkin_message, brand_name, brand_tagline, client_portal_heading, client_welcome_message, completed_onboarding'
        const legacyWorkspace = await supabase
          .from('workspaces')
          .select(workspaceColumns)
          .eq('id', workspaceId)
          .maybeSingle()
        workspace = legacyWorkspace.data as Record<string, unknown> | null
        workspaceError = legacyWorkspace.error as { message?: string } | null
      }

      if (profile?.role !== 'coach') {
        return { ok: false, error: 'forbidden' }
      }

      if (workspaceError || profileError) {
        return { ok: false, error: 'load_failed' }
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

      const profileLogo = typeof prof?.logo_url === 'string' ? prof.logo_url.trim() : ''
      const coachProfileImage =
        typeof coachProfile?.profile_image_url === 'string' ? coachProfile.profile_image_url.trim() : ''
      const avatarUrl = profileLogo || coachProfileImage || null

      return {
        ok: true,
        data: {
          workspace: {
            id: (workspace?.id as string | undefined) ?? workspaceId,
            name: workspace?.name ?? null,
            displayName: workspace?.workspace_display_name ?? null,
            logoUrl: workspace?.logo_url ?? null,
            timezone: workspace?.timezone ?? 'America/New_York',
            accentColor: workspace?.accent_color ?? null,
            accentColorLight: workspace?.accent_color_light ?? null,
            preferredPaymentMethods: workspace?.preferred_payment_methods ?? [],
            publicBookingEnabled: workspace?.public_booking_enabled ?? false,
            autoCheckinEnabled: workspace?.auto_checkin_enabled ?? false,
            autoCheckinMessage: workspace?.auto_checkin_message ?? null,
            brandName: workspace?.brand_name ?? null,
            brandTagline: workspace?.brand_tagline ?? null,
            clientPortalHeading: workspace?.client_portal_heading ?? null,
            clientWelcomeMessage: workspace?.client_welcome_message ?? null,
            completedOnboarding: workspace?.completed_onboarding ?? false,
            cashappUsername: workspace?.cashapp_username ?? null,
            venmoUsername: workspace?.venmo_username ?? null,
            paypalEmail: workspace?.paypal_email ?? null,
            zelleEmailOrPhone: workspace?.zelle_email_or_phone ?? null,
            stripeConnected: workspace?.stripe_connected ?? false,
            paymentInstructions: workspace?.payment_instructions ?? null,
          },
          profile: {
            firstName: firstName ?? '',
            lastName: lastName ?? '',
            fullName: fullName || null,
            bio: prof?.bio ?? null,
            phone: prof?.phone ?? null,
            avatarUrl,
            email: user.email ?? null,
            notifications: {
              newMessage: prof?.notification_new_message ?? true,
              sessionReminder: prof?.notification_session_reminder ?? true,
              clientActivity: prof?.notification_client_activity ?? true,
              paymentReceived: prof?.notification_payment_received ?? true,
            },
          },
        },
      }
    })

    if (!result.ok) {
      if (result.error === 'forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json(
        { error: 'Could not load settings. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: result.data })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
