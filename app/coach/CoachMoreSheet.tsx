'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type InkedIconName } from '@/components/icons/inked'

type Row = { href: string; label: string; icon: InkedIconName }
type Group = { title: string; rows: Row[] }

const GROUPS: Group[] = [
  { title: 'Coaching', rows: [
    { href: '/coach/schedule', label: 'Schedule', icon: 'schedule' },
    { href: '/coach/classes', label: 'Classes', icon: 'classes' },
    { href: '/coach/clients', label: 'Clients', icon: 'clients' },
    { href: '/coach/messages', label: 'Messages', icon: 'messages' },
  ] },
  { title: 'Offerings', rows: [
    { href: '/coach/programs', label: 'Programs', icon: 'programs' },
    { href: '/coach/packages', label: 'Packages', icon: 'packages' },
    { href: '/coach/memberships', label: 'Memberships', icon: 'memberships' },
  ] },
  { title: 'Money', rows: [
    { href: '/coach/payments', label: 'Payments', icon: 'payments' },
    { href: '/coach/invoices', label: 'Invoices', icon: 'invoices' },
    { href: '/coach/analytics', label: 'Analytics', icon: 'analytics' },
  ] },
  { title: 'Grow', rows: [
    { href: '/coach/promote', label: 'Promote', icon: 'promote' },
    { href: '/coach/leads', label: 'Lead Research', icon: 'leads' },
    { href: '/coach/videos', label: 'Videos', icon: 'videos' },
  ] },
  { title: 'Account', rows: [
    { href: '/coach/subscription', label: 'Subscription', icon: 'subscription' },
    { href: '/coach/settings', label: 'Settings', icon: 'settings' },
  ] },
]

export function CoachMoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[120] lg:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close menu" onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div className="gloss-glass absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-[20px] px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[var(--border-strong)]" />
        {GROUPS.map((g) => (
          <div key={g.title} className="mb-3">
            <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-quaternary)]">{g.title}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {g.rows.map((r) => {
                const active = pathname === r.href || pathname.startsWith(r.href + '/')
                return (
                  <Link
                    key={r.href}
                    href={r.href}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] ${active ? 'bg-[var(--accent-surface)] text-[var(--text-primary)] [&_svg]:text-[var(--accent)]' : 'text-[var(--text-secondary)] [&_svg]:text-[var(--text-tertiary)]'}`}
                  >
                    <Icon name={r.icon} size={17} />
                    {r.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
