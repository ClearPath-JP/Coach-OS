import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getClientWorkspaceBranding, type ClientWorkspaceBranding } from '@/lib/client-workspace-branding'

export const dynamic = 'force-dynamic'

/** Snake_case payment fields (alongside camelCase) for clients and integrations. */
function paymentFieldAliases(b: Pick<
  ClientWorkspaceBranding,
  | 'cashappUsername'
  | 'venmoUsername'
  | 'paypalEmail'
  | 'zelleEmailOrPhone'
  | 'paymentInstructions'
  | 'stripeConnected'
>) {
  return {
    cashapp_username: b.cashappUsername,
    venmo_username: b.venmoUsername,
    paypal_email: b.paypalEmail,
    zelle_email_or_phone: b.zelleEmailOrPhone,
    payment_instructions: b.paymentInstructions,
    stripe_connected: b.stripeConnected,
  }
}

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
    const branding = await getClientWorkspaceBranding(user.email)
    if (!branding) {
      const emptyPayment = {
        cashappUsername: null as string | null,
        venmoUsername: null as string | null,
        paypalEmail: null as string | null,
        zelleEmailOrPhone: null as string | null,
        stripeConnected: false,
        paymentInstructions: null as string | null,
      }
      return NextResponse.json({
        data: {
          workspaceId: null,
          brandName: null,
          brandTagline: null,
          clientPortalHeading: null,
          clientWelcomeMessage: null,
          logoUrl: null,
          ...emptyPayment,
          ...paymentFieldAliases(emptyPayment),
        },
      })
    }
    return NextResponse.json({
      data: { ...branding, ...paymentFieldAliases(branding) },
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
