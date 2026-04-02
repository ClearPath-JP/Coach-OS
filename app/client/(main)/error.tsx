'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export default function ClientMainSegmentError({
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
      <h1 className="text-xl font-medium text-[var(--color-text-primary)]">Something went wrong</h1>
      <p className="max-w-md text-[15px] text-[var(--color-muted)]">
        This part of your portal hit an unexpected error. Try again or go back to your home.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push('/client/portal')}>
          Back to portal
        </Button>
      </div>
      <p className="text-[13px] text-[var(--color-muted)]">
        <Link href="/client/portal" className="text-[var(--color-accent)] underline-offset-2 hover:underline">
          Portal home
        </Link>
      </p>
    </div>
  )
}
