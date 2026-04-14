'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export default function CoachSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="font-display text-[22px] font-medium tracking-[0.01em] text-[var(--text-primary)]">Something went wrong</h1>
      <p className="max-w-md text-[15px] text-[var(--text-tertiary)]">
        This coach area hit an unexpected error. Try again or return to your dashboard.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push('/coach/dashboard')}>
          Back to dashboard
        </Button>
      </div>
      <p className="text-[13px] text-[var(--text-tertiary)]">
        <Link href="/coach/dashboard" className="text-[var(--accent)] underline-offset-2 hover:underline">
          Coach home
        </Link>
      </p>
    </div>
  )
}
