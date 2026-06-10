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
          const done = prog.status === 'completed'
          const statusText = ({ active: 'Active', completed: 'Completed', paused: 'Paused' } as Record<string, string>)[prog.status ?? ''] ?? ((prog.status ?? '').charAt(0).toUpperCase() + (prog.status ?? '').slice(1).replace(/_/g, ' '))
          return (
            <div
              key={prog.clientProgramId}
              className="arcade-lift flex flex-col rounded-[16px] border-[3px] border-[var(--ink)] bg-[var(--bg-subtle)] p-6 shadow-[5px_5px_0_var(--ink)]"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-[family-name:var(--font-display)] text-[17px] font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">{prog.title}</h3>
                <span
                  className={cn(
                    'arcade-badge shrink-0',
                    done && 'arcade-badge-teal',
                    prog.status === 'active' && 'arcade-badge-blue'
                  )}
                >
                  {statusText}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between font-[family-name:var(--font-display)] text-[12px] font-bold text-[var(--text-secondary)]">
                <span>{prog.modulesCompleted} of {prog.totalModules} modules</span>
                <span>{pct}%</span>
              </div>
              <div className="arcade-track mt-1.5 h-2.5">
                <div
                  className={cn('arcade-fill', done && 'arcade-fill')}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <Link href={`/client/programs/${prog.programId}`} className="mt-auto block pt-5">
                <Button variant="secondary" className="w-full min-h-[44px]">
                  Continue
                </Button>
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
