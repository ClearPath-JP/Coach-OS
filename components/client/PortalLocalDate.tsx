'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { portalGreetingLine } from '@/lib/portal-time-greeting'

/**
 * Date + greeting rendered in the VISITOR's timezone.
 *
 * The portal page is a server component — on Vercel `new Date()` there is UTC, so an
 * evening student would see tomorrow's date and "Good morning". Same fix as the coach
 * dashboard (commits f545ae5 / 4bc7975): render a neutral placeholder during SSR and the
 * hydration pass, then compute the real value after mount so server and client first
 * render match (no React #418 hydration mismatch).
 */
export function PortalLocalDate({ className }: { className?: string }) {
  const [text, setText] = useState('')
  useEffect(() => {
    setText(format(new Date(), 'EEEE, MMMM d, yyyy'))
  }, [])
  // Non-breaking space holds the line height until the date fills in.
  return <p className={className}>{text || '\u00A0'}</p>
}

export function PortalLocalGreeting({
  firstName,
  className,
}: {
  firstName: string
  className?: string
}) {
  const [line, setLine] = useState('')
  useEffect(() => {
    setLine(portalGreetingLine(firstName, new Date()))
  }, [firstName])
  // Time-neutral placeholder during SSR; refines to Good morning/afternoon/evening after mount.
  return <h1 className={className}>{line || `Hey, ${firstName} 👋`}</h1>
}
