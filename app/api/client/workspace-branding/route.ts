import { NextResponse } from 'next/server'
import { brandingCacheKey, withCache } from '@/lib/api-cache'
import {
  loadWorkspaceBrandingByWorkspaceId,
  type ClientWorkspaceBranding,
} from '@/lib/client-workspace-branding'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase-server'
import { normalizeEmail } from '@/lib/utils'

/** Snake_case payment fields (alongside camelCase) for clients and integrations. */
function paymentFieldAliases(b: Pick<
  ClientWorkspaceBranding,
  | 'cashappUsername'
  | 'venmoUsername'
  | 'paypalEmail'
  | 'zelleEmailOrPhone'
  | 'paymentInstructions'
  | 'stripeConnected'
  | 'stripeCardPaymentsEnabled'
>) {
  return {
    cashapp_username: b.cashappUsername,
    venmo_username: b.venmoUsername,
    paypal_email: b.paypalEmail,
    zelle_email_or_phone: b.zelleEmailOrPhone,
    payment_instructions: b.paymentInstructions,
    stripe_connected: b.stripeConnected,
    stripe_card_payments_enabled: b.stripeCardPaymentsEnabled,
  }
}

export const dynamic = 'force-dynamic'

const BRANDING_CACHE_CONTROL = 'private, max-age=120, stale-while-revalidate=600'

/**
 * GET /api/client/workspace-branding — white-label fields for the current client (session).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let service
    try {
      service = createServiceClient()
    } catch {
      return NextResponse.json(
        { error: 'Server configuration error — contact support' },
        { status: 503 }
      )
    }

    const email = normalizeEmail(user.email)
    const { data: client } = await service
      .from('clients')
      .select('workspace_id')
      .eq('email', email)
      .maybeSingle()

    if (!client?.workspace_id) {
      const emptyPayment = {
        cashappUsername: null as string | null,
        venmoUsername: null as string | null,
        paypalEmail: null as string | null,
        zelleEmailOrPhone: null as string | null,
        stripeConnected: false,
        stripeCardPaymentsEnabled: false,
        paymentInstructions: null as string | null,
      }
      return NextResponse.json(
        {
          data: {
            workspaceId: null,
            brandName: null,
            brandTagline: null,
            clientPortalHeading: null,
            clientWelcomeMessage: null,
            logoUrl: null,
            accentColor: null,
            ...emptyPayment,
            ...paymentFieldAliases(emptyPayment),
          },
        },
        { headers: { 'Cache-Control': BRANDING_CACHE_CONTROL } }
      )
    }

    const wid = client.workspace_id as string
    const branding = await withCache(brandingCacheKey(wid), 300, () => loadWorkspaceBrandingByWorkspaceId(wid))
    if (!branding) {
      const emptyPayment = {
        cashappUsername: null as string | null,
        venmoUsername: null as string | null,
        paypalEmail: null as string | null,
        zelleEmailOrPhone: null as string | null,
        stripeConnected: false,
        stripeCardPaymentsEnabled: false,
        paymentInstructions: null as string | null,
      }
      return NextResponse.json(
        {
          data: {
            workspaceId: wid,
            brandName: null,
            brandTagline: null,
            clientPortalHeading: null,
            clientWelcomeMessage: null,
            logoUrl: null,
            accentColor: null,
            ...emptyPayment,
            ...paymentFieldAliases(emptyPayment),
          },
        },
        { headers: { 'Cache-Control': BRANDING_CACHE_CONTROL } }
      )
    }

    return NextResponse.json(
      {
        data: { ...branding, ...paymentFieldAliases(branding) },
      },
      { headers: { 'Cache-Control': BRANDING_CACHE_CONTROL } }
    )
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
