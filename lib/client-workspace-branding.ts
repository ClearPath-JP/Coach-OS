import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
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
  /** True when Stripe Connect account is stored — client invoice checkout is allowed */
  stripeCardPaymentsEnabled: boolean
  paymentInstructions: string | null
}

function mapWorkspaceRowToBranding(ws: Record<string, unknown>): ClientWorkspaceBranding | null {
  if (!ws?.['id']) return null

  const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const brand =
    trim(ws['brand_name']) ||
    trim(ws['workspace_display_name']) ||
    trim(ws['name']) ||
    null

  const connectId =
    typeof ws['stripe_connect_account_id'] === 'string' ? ws['stripe_connect_account_id'].trim() : ''
  const stripeConnected = (ws['stripe_connected'] as boolean | null) ?? false
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
    stripeConnected,
    stripeCardPaymentsEnabled: Boolean(connectId) && stripeConnected,
    paymentInstructions: (ws['payment_instructions'] as string | null) ?? null,
  }
}

/**
 * Loads branding from workspaces row(s). Used by Redis-cached API and per-request cached portal loaders.
 */
export async function loadWorkspaceBrandingByWorkspaceId(
  workspaceId: string
): Promise<ClientWorkspaceBranding | null> {
  let service: SupabaseClient
  try {
    service = createServiceClient()
  } catch {
    return null
  }
  return fetchWorkspaceBrandingWithService(service, workspaceId)
}

export async function fetchWorkspaceBrandingWithService(
  service: SupabaseClient,
  workspaceId: string
): Promise<ClientWorkspaceBranding | null> {
  const fullSelect =
    'id, name, workspace_display_name, brand_name, brand_tagline, client_portal_heading, client_welcome_message, logo_url, cashapp_username, venmo_username, paypal_email, zelle_email_or_phone, stripe_connected, stripe_connect_account_id, payment_instructions'
  const legacySelect =
    'id, name, workspace_display_name, brand_name, brand_tagline, client_portal_heading, client_welcome_message, logo_url'
  const fullRes = await service.from('workspaces').select(fullSelect).eq('id', workspaceId).maybeSingle()
  const legacyRes =
    fullRes.error?.message?.includes('does not exist')
      ? await service.from('workspaces').select(legacySelect).eq('id', workspaceId).maybeSingle()
      : null
  const raw = (legacyRes?.data ?? fullRes.data) as Record<string, unknown> | null
  if (!raw) return null
  return mapWorkspaceRowToBranding(raw)
}

/**
 * Loads workspace white-label fields for the signed-in client (service role; bypasses RLS).
 * Cached per request when called from multiple server components.
 */
export const getClientWorkspaceBranding = cache(
  async (userEmail: string | undefined | null): Promise<ClientWorkspaceBranding | null> => {
    if (!userEmail?.trim()) return null
    let service: SupabaseClient
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
    return fetchWorkspaceBrandingWithService(service, client.workspace_id)
  }
)
