'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

type ClientProgram = {
  clientProgramId: string
  programId: string
  title: string
  status: string
  totalModules: number
  modulesCompleted: number
}

export function ClientPortalProgramCard() {
  const [program, setProgram] = useState<ClientProgram | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/client/programs')
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.length) {
          const active = json.data.find((p: ClientProgram) => p.status === 'active')
          setProgram(active ?? json.data[0])
        }
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card variant="raised" padding="lg" className="flex min-h-[132px] min-w-0 flex-col">
        <Skeleton className="mb-2 h-4 w-28" />
        <Skeleton className="h-4 w-[80%] max-w-[240px]" />
        <Skeleton className="mt-3 h-2 w-full rounded-full" />
        <Skeleton className="mt-2 h-3 w-48" />
        <div className="min-h-2 flex-1" aria-hidden />
        <Skeleton className="mt-2 h-11 w-full rounded-[var(--radius-md)]" />
      </Card>
    )
  }

  if (!program) {
    return (
      <Card variant="raised" padding="lg" className="flex min-h-[132px] min-w-0 flex-col">
        <h2 className="text-[15px] font-medium text-[var(--color-text-primary)] mb-1">
          My Program
        </h2>
        <p className="text-[14px] text-[var(--color-muted)] flex items-center gap-2">
          <span aria-hidden>📋</span>
          No program assigned yet
        </p>
      </Card>
    )
  }

  const pct =
    program.totalModules > 0
      ? Math.round((program.modulesCompleted / program.totalModules) * 100)
      : 0

  return (
    <Card variant="raised" padding="lg" className="flex min-h-[132px] min-w-0 flex-col">
      <h2 className="text-[15px] font-medium text-[var(--color-text-primary)] mb-1">
        My Program
      </h2>
      <p className="text-[14px] text-[var(--color-ink)] font-medium">{program.title}</p>
      <div className="mt-2 h-2 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        {program.modulesCompleted} of {program.totalModules} modules complete
      </p>
      <Link href={`/client/programs/${program.programId}`} className="mt-auto block pt-2">
        <Button variant="secondary" className="w-full min-h-[44px]">
          Continue
        </Button>
      </Link>
    </Card>
  )
}
