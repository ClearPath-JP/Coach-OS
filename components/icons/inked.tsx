import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type InkedIconName =
  | 'dashboard' | 'schedule' | 'classes' | 'clients' | 'messages'
  | 'programs' | 'packages' | 'memberships' | 'payments' | 'invoices'
  | 'analytics' | 'promote' | 'leads' | 'videos' | 'subscription'
  | 'settings' | 'search'

const PATHS: Record<InkedIconName, ReactNode> = {
  dashboard: (<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="4.5" rx="1.5" /><rect x="13" y="11" width="7" height="9" rx="1.5" /><rect x="4" y="13.5" width="7" height="6.5" rx="1.5" /></>),
  schedule: (<><rect x="4" y="5.5" width="16" height="15" rx="2.5" /><path d="M4 10h16M8.5 3v4.5M15.5 3v4.5" /></>),
  classes: (<><path d="M3 8.5a1.5 1.5 0 0 1 1.5-1.5h15A1.5 1.5 0 0 1 21 8.5v2a1.6 1.6 0 0 0 0 3v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15v-2a1.6 1.6 0 0 0 0-3z" /><path d="M13 7v10" strokeDasharray="1.5 2.2" /></>),
  clients: (<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19.5a5.6 5.6 0 0 1 11 0" /><circle cx="17.5" cy="9" r="2.3" /><path d="M16 14.6a4.4 4.4 0 0 1 4.5 4.4" /></>),
  messages: (<path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16h-7l-4 3.2V16H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 5z" />),
  programs: (<><rect x="4.5" y="3.5" width="15" height="17" rx="2" /><path d="M8 8.5h8M8 12h8M8 15.5h5" /></>),
  packages: (<><path d="M12 3l8 4v9l-8 4-8-4V7z" /><path d="M4 7l8 4 8-4M12 11v9" /></>),
  memberships: (<><circle cx="12" cy="9.5" r="5" /><path d="M9 13.5L7.5 21l4.5-2.6L16.5 21 15 13.5" /></>),
  payments: (<><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18M6.5 14.5h4" /></>),
  invoices: (<><path d="M6.5 3.5h11v17l-2-1.4-1.8 1.4-1.7-1.4-1.8 1.4-1.9-1.4-1.1.8z" /><path d="M9.5 8.5h5M9.5 12h5" /></>),
  analytics: (<><path d="M4 4v16h16" /><path d="M7.5 15.5l3.5-4 2.5 2.4 4-5.4" /></>),
  promote: (<><path d="M4 10v4l11 4.5V5.5z" /><path d="M15 8.5a3.5 3.5 0 0 1 0 7" /><path d="M7 14.5v3.5" /></>),
  leads: (<><circle cx="10" cy="10.5" r="5.2" /><path d="M14 14.5l5.5 5.5" /><path d="M18 3.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" /></>),
  videos: (<><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M10 9.5l4.5 2.5L10 14.5z" /></>),
  subscription: (<path d="M4 18.5h16M4.5 18l-1-9 4.5 4 4-7 4 7 4.5-4-1 9" />),
  settings: (<><path d="M4 8h16M4 16h16" /><circle cx="9" cy="8" r="2.4" /><circle cx="15" cy="16" r="2.4" /></>),
  search: (<><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></>),
}

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.75,
  className,
  style,
}: {
  name: InkedIconName
  size?: number
  strokeWidth?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
      style={style}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  )
}

/** Brass brush-circle — the signature hero mark (login, empty states, loading). */
export function Enso({ size = 72, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className} aria-hidden>
      <path d="M76 26 A34 34 0 1 0 80 60" stroke="var(--cp-accent)" strokeWidth="7" strokeLinecap="round" />
      <path d="M73 23 A37 37 0 1 0 83 57" stroke="color-mix(in srgb, var(--cp-accent) 30%, transparent)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
