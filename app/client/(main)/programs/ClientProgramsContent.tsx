'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

type ClientProgram = {
  clientProgramId: string
  programId: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  status: string
  totalModules: number
  modulesCompleted: number
  assignedAt: string
  completedAt: string | null
}

function ProgramCardSkeleton() {
  return (
    <Card variant="raised" padding="lg" className="animate-pulse">
      <div className="h-5 w-2/3 rounded bg-[var(--color-border)]" />
      <div className="mt-3 h-2 w-full rounded bg-[var(--color-border)]" />
      <div className="mt-4 h-10 rounded-lg bg-[var(--color-border)]" />
    </Card>
  )
}

export function ClientProgramsContent() {
  const [programs, setPrograms] = useState<ClientProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPrograms = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/client/programs')
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load programs')
        setPrograms([])
        return
      }
      setPrograms(json.data ?? [])
    } catch {
      setError('Something went wrong — check your connection and try again')
      setPrograms([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPrograms()
  }, [fetchPrograms])

  if (loading) {
    return (
      <div>
        <PageHeader title="My Programs" />
        <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-2">
          {[1, 2].map((i) => (
            <ProgramCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <PageHeader title="My Programs" />
        <Card className="mt-6 text-center">
          <p className="text-[var(--color-muted)]">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={fetchPrograms}>
            Try again
          </Button>
        </Card>
      </div>
    )
  }

  if (programs.length === 0) {
    return (
      <div>
        <PageHeader title="My Programs" />
        <EmptyState
          className="mt-6"
          title="No programs assigned yet"
          description="Your coach will assign programs for you to work through."
          action={
            <Link href="/client/portal">
              <Button variant="secondary">Go to portal</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="My Programs" />
      <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-2">
        {programs.map((prog) => {
          const pct = prog.totalModules > 0 ? Math.round((prog.modulesCompleted / prog.totalModules) * 100) : 0
          return (
            <Card key={prog.clientProgramId} variant="raised" padding="lg">
              <h3 className="font-medium text-[var(--color-ink)]">{prog.title}</h3>
              <div className="mt-2 h-2 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                {prog.modulesCompleted} of {prog.totalModules} modules complete
              </p>
              <span
                className={cn(
                  'mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
                  prog.status === 'completed' && 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
                  prog.status === 'active' && 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]',
                  prog.status === 'paused' && 'bg-[var(--color-muted)]/20 text-[var(--color-muted)]'
                )}
              >
                {({ active: 'Active', completed: 'Completed', paused: 'Paused' } as Record<string, string>)[prog.status ?? ''] ?? ((prog.status ?? '').charAt(0).toUpperCase() + (prog.status ?? '').slice(1).replace(/_/g, ' '))}
              </span>
              <Link href={`/client/programs/${prog.programId}`} className="block mt-4">
                <Button variant="secondary" className="w-full min-h-[44px]">
                  Continue
                </Button>
              </Link>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
