import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'
import { checkRateLimitAsync } from '@/lib/rate-limit'

type ActivityRow = {
  id: string
  at: string
  kind: 'module_completed' | 'program_started'
  summary: string
  clientFirst: string
}

function clientLabel(c: { first_name: string | null; last_name: string | null } | null): string {
  const n = [c?.first_name, c?.last_name].filter(Boolean).join(' ').trim()
  return n || 'Client'
}

function firstOnly(c: { first_name: string | null; last_name: string | null } | null): string {
  return c?.first_name?.trim() || clientLabel(c).split(' ')[0] || 'Client'
}

function asClientRow(
  v: unknown
): { first_name: string | null; last_name: string | null } | null {
  if (!v || typeof v !== 'object') return null
  if (Array.isArray(v)) {
    const row = v[0] as Record<string, unknown> | undefined
    if (!row) return null
    return {
      first_name: (row.first_name as string | null) ?? null,
      last_name: (row.last_name as string | null) ?? null,
    }
  }
  const o = v as Record<string, unknown>
  return {
    first_name: (o.first_name as string | null) ?? null,
    last_name: (o.last_name as string | null) ?? null,
  }
}

function asModuleTitle(v: unknown): { title: string | null } | null {
  if (!v || typeof v !== 'object') return null
  if (Array.isArray(v)) {
    const row = v[0] as Record<string, unknown> | undefined
    if (!row) return null
    return { title: (row.title as string | null) ?? null }
  }
  const o = v as Record<string, unknown>
  return { title: (o.title as string | null) ?? null }
}

/**
 * GET /api/coach/program-activity — recent client program events for dashboard. Coach only.
 */
export async function GET() {
  try {
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { user, workspaceId, supabase } = auth

    const { success, retryAfter } = await checkRateLimitAsync(`coach-program-activity:${user.id}`, {
      windowMs: 60_000,
      max: 60,
    })
    if (!success) {
      const res = NextResponse.json(
        { error: 'Too many attempts — please wait a minute and try again' },
        { status: 429 }
      )
      if (retryAfter) res.headers.set('Retry-After', String(retryAfter))
      return res
    }

    const { data: completions } = await supabase
      .from('program_progress')
      .select('id, completed_at, clients(first_name, last_name), program_modules(title)')
      .eq('workspace_id', workspaceId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(20)

    const rows: ActivityRow[] = []

    for (const r of completions ?? []) {
      const at = r.completed_at as string
      if (!at) continue
      const clients = asClientRow(r.clients)
      const mod = asModuleTitle(r.program_modules)
      const name = firstOnly(clients)
      const modTitle = mod?.title?.trim() || 'a module'
      rows.push({
        id: `c-${r.id}`,
        at,
        kind: 'module_completed',
        summary: `${name} completed ${modTitle}`,
        clientFirst: name,
      })
    }

    const { data: starts } = await supabase
      .from('client_programs')
      .select('id, created_at, program_id, clients(first_name, last_name)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(15)

    const programIds = [...new Set((starts ?? []).map((s) => s.program_id as string).filter(Boolean))]
    let titles: Record<string, string> = {}
    if (programIds.length > 0) {
      const { data: progs } = await supabase.from('programs').select('id, title').in('id', programIds)
      titles = Object.fromEntries((progs ?? []).map((p) => [p.id as string, (p.title as string) ?? 'Program']))
    }

    for (const r of starts ?? []) {
      const at = r.created_at as string
      if (!at) continue
      const clients = asClientRow(r.clients)
      const name = firstOnly(clients)
      const pid = r.program_id as string
      const title = titles[pid]?.trim() || 'a program'
      rows.push({
        id: `s-${r.id}`,
        at,
        kind: 'program_started',
        summary: `${name} started ${title}`,
        clientFirst: name,
      })
    }

    rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    const seen = new Set<string>()
    const deduped: ActivityRow[] = []
    for (const row of rows) {
      const key = `${row.kind}:${row.summary}:${row.at.slice(0, 16)}`
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(row)
      if (deduped.length >= 10) break
    }

    const res = NextResponse.json({ data: deduped.slice(0, 8) })
    res.headers.set('Cache-Control', 'private, max-age=20')
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Something went wrong'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
