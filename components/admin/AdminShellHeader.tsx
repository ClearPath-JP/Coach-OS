'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export function AdminShellHeader({ email }: { email: string }) {
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
    <header className="sticky top-0 z-30 border-b border-[var(--border-default)] bg-[var(--bg-app)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/admin/overview" className="text-[17px] font-semibold text-[var(--text-primary)]">
            Sensei
          </Link>
          <span className="rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-[13px] text-[var(--text-muted)] sm:inline">{email}</span>
          <button
            type="button"
            disabled={loading}
            onClick={() => void onSignOut()}
            className="rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50"
          >
            {loading ? 'Signing out...' : 'Log out'}
          </button>
        </div>
      </div>
    </header>
  )
}
