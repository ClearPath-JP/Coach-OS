import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizeEmail } from '@/lib/utils'

export type ClientWorkspaceBranding = {
  workspaceId: string
  brandName: string | null
  brandTagline: string | null
  clientPortalHeading: string | null
  clientWelcomeMessage: string | null
  /** Workspace / coach logo for portal chrome */
  logoUrl: string | null
  cashappUsername: string | null
  venmoUsername: string | null
  paypalEmail: string | null
  zelleEmailOrPhone: string | null
  stripeConnected: boolean
  paymentInstructions: string | null
}

/**
 * Loads workspace white-label fields for the signed-in client (service role; bypasses RLS).
 * Cached per request when called from multiple server components.
 */
export const getClientWorkspaceBranding = cache(
  async (userEmail: string | undefined | null): Promise<ClientWorkspaceBranding | null> => {
    if (!userEmail?.trim()) return null
    let service
    try {
      service = createServiceClient()
    } catch {
      return null
    }
    const email = normalizeEmail(userEmail)
    const { data: client } = await service
      .from('clients')
      .select('workspace_id')
      .eq('email', email)
      .maybeSingle()
    if (!client?.workspace_id) return null
    const fullSelect =
      'id, name, workspace_display_name, brand_name, brand_tagline, client_portal_heading, client_welcome_message, logo_url, cashapp_username, venmo_username, paypal_email, zelle_email_or_phone, stripe_connected, payment_instructions'
    const legacySelect =
      'id, name, workspace_display_name, brand_name, brand_tagline, client_portal_heading, client_welcome_message, logo_url'
    const fullRes = await service
      .from('workspaces')
      .select(fullSelect)
      .eq('id', client.workspace_id)
      .maybeSingle()
    const legacyRes =
      fullRes.error?.message?.includes('does not exist')
        ? await service
            .from('workspaces')
            .select(legacySelect)
            .eq('id', client.workspace_id)
            .maybeSingle()
        : null
    const ws = (legacyRes?.data ?? fullRes.data) as Record<string, unknown> | null
    if (!ws?.['id']) return null

    const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
    const brand =
      trim(ws['brand_name']) ||
      trim(ws['workspace_display_name']) ||
      trim(ws['name']) ||
      null

    return {
      workspaceId: ws['id'] as string,
      brandName: brand,
      brandTagline: (ws['brand_tagline'] as string | null) ?? null,
      clientPortalHeading: (ws['client_portal_heading'] as string | null) ?? null,
      clientWelcomeMessage: (ws['client_welcome_message'] as string | null) ?? null,
      logoUrl: (ws['logo_url'] as string | null) ?? null,
      cashappUsername: (ws['cashapp_username'] as string | null) ?? null,
      venmoUsername: (ws['venmo_username'] as string | null) ?? null,
      paypalEmail: (ws['paypal_email'] as string | null) ?? null,
      zelleEmailOrPhone: (ws['zelle_email_or_phone'] as string | null) ?? null,
      stripeConnected: (ws['stripe_connected'] as boolean | null) ?? false,
      paymentInstructions: (ws['payment_instructions'] as string | null) ?? null,
    }
  }
)
