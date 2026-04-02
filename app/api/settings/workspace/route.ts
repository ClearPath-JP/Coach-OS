import { NextResponse } from 'next/server'
import { invalidateBrandingCache, invalidateSettingsCachesForWorkspace } from '@/lib/api-cache'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimitAsync } from '@/lib/rate-limit'
import { updateWorkspaceSettingsSchema } from '@/lib/validations'

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)
    if (!workspaceId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { success, retryAfter } = await checkRateLimitAsync(`settings-workspace:${user.id}`, {
      windowMs: 60 * 1000,
      max: 30,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const body = await request.json()
    const parsed = updateWorkspaceSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (parsed.data.displayName !== undefined) {
      updates.workspace_display_name = parsed.data.displayName
      if (parsed.data.displayName === null) {
        // Allow clearing display name without overwriting internal workspace name
      } else {
        const trimmed = parsed.data.displayName.trim()
        if (trimmed.length > 0) {
          updates.name = trimmed
        }
      }
    }
    if (parsed.data.accentColor !== undefined) updates.accent_color = parsed.data.accentColor
    if (parsed.data.accentColorLight !== undefined) updates.accent_color_light = parsed.data.accentColorLight
    if (parsed.data.timezone !== undefined) updates.timezone = parsed.data.timezone
    if (parsed.data.logoUrl !== undefined) updates.logo_url = parsed.data.logoUrl
    if (parsed.data.preferredPaymentMethods !== undefined) {
      updates.preferred_payment_methods = parsed.data.preferredPaymentMethods
    }
    if (parsed.data.brandName !== undefined) updates.brand_name = parsed.data.brandName
    if (parsed.data.brandTagline !== undefined) updates.brand_tagline = parsed.data.brandTagline
    if (parsed.data.clientPortalHeading !== undefined) {
      updates.client_portal_heading = parsed.data.clientPortalHeading
    }
    if (parsed.data.clientWelcomeMessage !== undefined) {
      updates.client_welcome_message = parsed.data.clientWelcomeMessage
    }
    if (parsed.data.cashappUsername !== undefined) updates.cashapp_username = parsed.data.cashappUsername
    if (parsed.data.venmoUsername !== undefined) updates.venmo_username = parsed.data.venmoUsername
    if (parsed.data.paypalEmail !== undefined) updates.paypal_email = parsed.data.paypalEmail
    if (parsed.data.zelleEmailOrPhone !== undefined) updates.zelle_email_or_phone = parsed.data.zelleEmailOrPhone
    if (parsed.data.stripeConnected !== undefined) {
      updates.stripe_connected = parsed.data.stripeConnected
      if (parsed.data.stripeConnected === false) {
        updates.stripe_connect_account_id = null
      }
    }
    if (parsed.data.paymentInstructions !== undefined) updates.payment_instructions = parsed.data.paymentInstructions

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ data: 'No changes' })
    }

    const { error } = await supabase
      .from('workspaces')
      .update(updates)
      .eq('id', workspaceId)

    if (error) return NextResponse.json({ error: 'Could not update workspace settings' }, { status: 500 })
    void invalidateSettingsCachesForWorkspace(workspaceId)
    void invalidateBrandingCache(workspaceId)
    return NextResponse.json({ data: 'Workspace settings updated' })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
