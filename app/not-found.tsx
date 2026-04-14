'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="section-label-got">404</p>
      <h1 className="font-display text-[22px] font-medium tracking-[0.01em] text-[var(--text-primary)]">Page not found</h1>
      <p className="max-w-md text-[15px] text-[var(--text-tertiary)]">
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
