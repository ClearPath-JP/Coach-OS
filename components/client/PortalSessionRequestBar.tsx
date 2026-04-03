'use client'

import { useState } from 'react'
import { RequestSessionModal } from '@/components/client/RequestSessionModal'

export function PortalSessionRequestBar({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          'flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-transparent bg-transparent text-[14px] font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--bg-muted)]'
        }
      >
        <span aria-hidden>📅</span>
        Request a session from your coach
      </button>
      <RequestSessionModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
