'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  )
}

export function SignOutButton({
  variant,
  className,
}: {
  variant: 'sidebar' | 'nav'
  className?: string
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(false)

  const onSignOut = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onSignOut()}
      disabled={loading}
      className={cn(
        variant === 'sidebar' &&
          'flex w-full min-h-[44px] items-center gap-3 rounded-lg px-4 py-2.5 text-left text-[15px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]/50 hover:text-[var(--color-text-primary)] disabled:opacity-60',
        variant === 'nav' &&
          'inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg px-3 text-[13px] font-medium text-[var(--accent)] hover:bg-[var(--bg-muted)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:opacity-60',
        className
      )}
    >
      {variant === 'sidebar' ? <LogOutIcon className="shrink-0" /> : null}
      {loading ? 'Signing out…' : 'Log out'}
    </button>
  )
}
