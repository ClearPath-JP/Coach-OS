import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { resolveCoachWorkspaceIdForSession } from '@/lib/coach-workspace'
import { createClient } from '@/lib/supabase-server'
import { normalizeEmail } from '@/lib/utils'

export type CoachAuthResult =
  | {
      user: User
      workspaceId: string
      supabase: Awaited<ReturnType<typeof createClient>>
    }
  | { error: NextResponse }

export type ClientAuthResult =
  | {
      user: User
      clientId: string
      workspaceId: string
      supabase: Awaited<ReturnType<typeof createClient>>
    }
  | { error: NextResponse }

/**
 * Authenticated coach with workspace. Verifies session, profile role, and coaches row.
 */
export async function requireCoach(): Promise<CoachAuthResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (!user || authError) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'coach') {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  const workspaceId = await resolveCoachWorkspaceIdForSession(supabase, user.id)

  if (!workspaceId) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { user, workspaceId, supabase }
}

/**
 * Authenticated portal client: session + profile role + clients row by email.
 */
export async function requireClient(): Promise<ClientAuthResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (!user || authError) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'client') {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  const email = normalizeEmail(user.email)
  if (!email) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, workspace_id')
    .eq('email', email)
    .maybeSingle()

  if (clientError || !client) {
    return {
      error: NextResponse.json(
        { error: "We couldn't find your client record" },
        { status: 404 }
      ),
    }
  }

  return {
    user,
    clientId: client.id,
    workspaceId: client.workspace_id,
    supabase,
  }
}
