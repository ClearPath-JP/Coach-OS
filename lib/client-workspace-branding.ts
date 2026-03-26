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
    const { data: ws } = await service
      .from('workspaces')
      .select(
        'id, brand_name, brand_tagline, client_portal_heading, client_welcome_message, logo_url'
      )
      .eq('id', client.workspace_id)
      .maybeSingle()
    if (!ws?.id) return null
    return {
      workspaceId: ws.id,
      brandName: ws.brand_name ?? null,
      brandTagline: ws.brand_tagline ?? null,
      clientPortalHeading: ws.client_portal_heading ?? null,
      clientWelcomeMessage: ws.client_welcome_message ?? null,
      logoUrl: ws.logo_url ?? null,
    }
  }
)
