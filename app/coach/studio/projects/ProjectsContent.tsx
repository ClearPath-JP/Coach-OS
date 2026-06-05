'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

type Project = { id: string; title: string; status: string; updated_at: string }

export function ProjectsContent() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/studio/projects', { credentials: 'include' })
    const j = await res.json()
    if (!res.ok) { setErr(j.error ?? 'Could not load projects'); return }
    setProjects(j.data ?? [])
  }, [])

  useEffect(() => { void load() }, [load])

  async function createNew() {
    const res = await fetch('/api/studio/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title: 'Untitled' }),
    })
    const j = await res.json()
    if (!res.ok) { setErr(j.error ?? 'Could not create project'); return }
    const id = j.data?.id
    if (typeof id !== 'string' || !id) { setErr('Invalid response from server'); return }
    router.push(`/coach/studio/edit?project=${encodeURIComponent(id)}`)
  }

  async function remove(id: string) {
    if (typeof id !== 'string' || !id) return
    const res = await fetch(`/api/studio/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErr((j as { error?: string }).error ?? 'Could not delete project')
      return
    }
    void load()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={createNew}
          className="btn-primary-gloss inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors"
        >
          New project
        </button>
      </div>

      {err && <p className="text-sm text-red-400">{err}</p>}

      {projects && projects.length === 0 && (
        <EmptyState
          title="No projects yet"
          description="Start a new project to stitch clips into a post."
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {(projects ?? []).map((p) => (
          <Card key={p.id} className="flex items-center justify-between p-4">
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => router.push(`/coach/studio/edit?project=${encodeURIComponent(p.id)}`)}
            >
              <div className="truncate font-medium text-[var(--text-primary)]">{p.title}</div>
              <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                {p.status} · {new Date(p.updated_at).toLocaleDateString()}
              </div>
            </button>
            <button
              onClick={() => remove(p.id)}
              className="ml-3 shrink-0 text-xs text-[var(--text-tertiary)] transition-opacity hover:text-[var(--text-primary)]"
            >
              Delete
            </button>
          </Card>
        ))}
      </div>
    </div>
  )
}
