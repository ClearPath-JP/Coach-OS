import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-helpers'

type RouteContext = { params: Promise<{ id: string }> }

type ClientRef = { clientId: string; firstName: string | null; lastName: string | null }

/**
 * GET /api/videos/[id]/access — direct assignments + program placements + clients on those programs.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id: videoId } = await context.params
    const auth = await requireCoach()
    if ('error' in auth) return auth.error
    const { workspaceId, supabase } = auth

    const { data: video, error: vErr } = await supabase
      .from('videos')
      .select('id')
      .eq('id', videoId)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (vErr || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    const { data: directRows } = await supabase
      .from('video_assignments')
      .select('id, client_id, clients(first_name, last_name)')
      .eq('video_id', videoId)
      .eq('workspace_id', workspaceId)

    const direct = (directRows ?? []).map((r) => {
      const raw = r.clients as unknown
      const c = (Array.isArray(raw) ? raw[0] : raw) as {
        first_name: string | null
        last_name: string | null
      } | null
      return {
        assignmentId: r.id as string,
        clientId: r.client_id as string,
        firstName: c?.first_name ?? null,
        lastName: c?.last_name ?? null,
      }
    })

    const { data: contentRows } = await supabase
      .from('program_content')
      .select('id, title, module_id')
      .eq('video_id', videoId)
      .eq('workspace_id', workspaceId)

    const moduleIds = [...new Set((contentRows ?? []).map((r) => r.module_id as string))]
    let modules: { id: string; title: string; program_id: string }[] = []
    if (moduleIds.length > 0) {
      const { data: modData } = await supabase
        .from('program_modules')
        .select('id, title, program_id')
        .in('id', moduleIds)
        .eq('workspace_id', workspaceId)
      modules = (modData ?? []) as typeof modules
    }

    const modById = new Map(modules.map((m) => [m.id, m]))
    const programIds = [...new Set(modules.map((m) => m.program_id))]

    const programTitles = new Map<string, string>()
    if (programIds.length > 0) {
      const { data: progs } = await supabase
        .from('programs')
        .select('id, title')
        .in('id', programIds)
        .eq('workspace_id', workspaceId)
      for (const p of progs ?? []) {
        programTitles.set(p.id as string, (p.title as string) ?? 'Program')
      }
    }

    /** One entry per client per program (duplicate client_programs rows would break React keys). */
    const programClients = new Map<string, Map<string, ClientRef>>()
    if (programIds.length > 0) {
      const { data: cpRows } = await supabase
        .from('client_programs')
        .select('program_id, client_id, clients(first_name, last_name)')
        .in('program_id', programIds)
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')

      for (const row of cpRows ?? []) {
        const pid = row.program_id as string
        const cid = row.client_id as string
        const rawC = row.clients as unknown
        const c = (Array.isArray(rawC) ? rawC[0] : rawC) as {
          first_name: string | null
          last_name: string | null
        } | null
        let byClient = programClients.get(pid)
        if (!byClient) {
          byClient = new Map()
          programClients.set(pid, byClient)
        }
        if (byClient.has(cid)) continue
        byClient.set(cid, {
          clientId: cid,
          firstName: c?.first_name ?? null,
          lastName: c?.last_name ?? null,
        })
      }
    }

    const inPrograms = (contentRows ?? []).map((row) => {
      const mod = modById.get(row.module_id as string)
      const pid = mod?.program_id ?? ''
      return {
        contentId: row.id as string,
        contentTitle: (row.title as string | null) ?? null,
        moduleId: row.module_id as string,
        moduleTitle: mod?.title ?? 'Module',
        programId: pid,
        programTitle: programTitles.get(pid) ?? 'Program',
        clientsWithProgramAccess: [...(programClients.get(pid)?.values() ?? [])],
      }
    })

    return NextResponse.json({
      data: {
        direct,
        inPrograms,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong — check your connection and try again' },
      { status: 500 }
    )
  }
}
