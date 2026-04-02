'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export function AdminSidebarFooter({ email }: { email: string }) {
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
    <div className="mt-auto border-t border-white/10 px-2 pt-3">
      <Link
        href="/admin/guide"
        className="mb-2 flex w-full items-center justify-center rounded-[8px] px-2 py-2 text-[13px] font-medium text-sky-300 hover:bg-white/10 hover:text-sky-200"
      >
        How to use admin
      </Link>
      <p className="truncate px-1 text-[12px] text-white/80">{email}</p>
      <button
        type="button"
        disabled={loading}
        onClick={() => void onSignOut()}
        className="mt-2 flex w-full items-center justify-center rounded-[8px] bg-white/10 px-2 py-2 text-[14px] font-medium text-white hover:bg-white/15 disabled:opacity-50"
      >
        {loading ? 'Signing out…' : 'Log out'}
      </button>
    </div>
  )
}
