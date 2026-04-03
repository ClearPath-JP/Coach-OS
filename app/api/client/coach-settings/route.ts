import { NextResponse } from 'next/server'
import { coerceToAllowedCoachAccent } from '@/lib/coach-accent-phase4'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase-server'
import { normalizeEmail } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * GET /api/client/coach-settings — coach workspace accent for the signed-in client.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) {
      return NextResponse.json(
        { accentColor: coerceToAllowedCoachAccent(null) },
        {
          headers: {
            'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
          },
        }
      )
    }

    let service
    try {
      service = createServiceClient()
    } catch {
      return NextResponse.json(
        { accentColor: coerceToAllowedCoachAccent(null) },
        {
          headers: {
            'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
          },
        }
      )
    }

    const email = normalizeEmail(user.email)
    const { data: client } = await service
      .from('clients')
      .select('workspace_id')
      .eq('email', email)
      .maybeSingle()

    if (!client?.workspace_id) {
      return NextResponse.json(
        { accentColor: coerceToAllowedCoachAccent(null) },
        {
          headers: {
            'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
          },
        }
      )
    }

    const { data: workspace } = await service
      .from('workspaces')
      .select('accent_color')
      .eq('id', client.workspace_id)
      .maybeSingle()

    const raw = typeof workspace?.accent_color === 'string' ? workspace.accent_color.trim() : ''
    return NextResponse.json(
      { accentColor: coerceToAllowedCoachAccent(raw || null) },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
        },
      }
    )
  } catch {
    return NextResponse.json(
      { accentColor: coerceToAllowedCoachAccent(null) },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
        },
      }
    )
  }
}
