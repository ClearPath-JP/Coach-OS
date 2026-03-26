'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-[13px] font-medium uppercase tracking-wider text-[var(--color-muted)]">404</p>
      <h1 className="text-xl font-medium text-[var(--color-text-primary)]">Page not found</h1>
      <p className="max-w-md text-[15px] text-[var(--color-muted)]">
        That URL does not exist or was removed. Choose where to go next.
      </p>
      <div className="flex flex-col flex-wrap justify-center gap-3 sm:flex-row">
        <Button type="button" variant="secondary" onClick={() => router.push('/coach/dashboard')}>
          Coach dashboard
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push('/client/portal')}>
          Client portal
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/')}>
          Home
        </Button>
      </div>
    </div>
  )
}
