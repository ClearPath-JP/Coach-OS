'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'

const cookieName = (workspaceId: string) => `clearpath_seen_welcome_${workspaceId}`

export function ClientPortalWelcome({
  workspaceId,
  welcomeMessage,
}: {
  workspaceId: string
  welcomeMessage: string
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const key = cookieName(workspaceId)
    queueMicrotask(() => {
      if (document.cookie.split(';').some((c) => c.trim().startsWith(`${key}=`))) {
        setVisible(false)
      } else {
        setVisible(true)
      }
    })
  }, [workspaceId])

  if (!visible || !welcomeMessage.trim()) return null

  return (
    <Card variant="raised" padding="lg" className="w-full min-w-0 border-[var(--color-border)] bg-[var(--color-bg)]/95">
      <p className="text-[15px] leading-[var(--leading-body)] text-[var(--color-text-secondary)]">{welcomeMessage}</p>
      <button
        type="button"
        className="mt-3 inline-flex min-h-[44px] min-w-[44px] items-center text-[13px] font-medium text-[var(--color-accent)] hover:underline"
        onClick={() => {
          const maxAge = 60 * 60 * 24 * 365
          document.cookie = `${cookieName(workspaceId)}=1;path=/;max-age=${maxAge};SameSite=Lax`
          setVisible(false)
        }}
      >
        Dismiss
      </button>
    </Card>
  )
}
