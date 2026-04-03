'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export default function AdminSegmentError({
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
      <h1 className="text-xl font-medium text-slate-900">Something went wrong</h1>
      <p className="max-w-md text-[15px] text-slate-600">
        The admin console hit an unexpected error. Try again or return to the overview.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push('/admin/overview')}>
          Back to overview
        </Button>
      </div>
      <p className="text-[13px] text-slate-500">
        <Link href="/admin/overview" className="font-medium text-blue-700 underline-offset-2 hover:underline">
          Admin home
        </Link>
      </p>
    </div>
  )
}
