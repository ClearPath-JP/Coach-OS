import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getClientWorkspaceBranding } from '@/lib/client-workspace-branding'

export const dynamic = 'force-dynamic'

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
      return NextResponse.json({
        data: {
          workspaceId: null,
          brandName: null,
          brandTagline: null,
          clientPortalHeading: null,
          clientWelcomeMessage: null,
        },
      })
    }
    return NextResponse.json({ data: branding })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
