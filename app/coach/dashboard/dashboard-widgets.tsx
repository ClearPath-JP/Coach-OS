'use client'

import Link from 'next/link'
import { Icon, type InkedIconName } from '@/components/icons/inked'
import type { TodayItem, MessageItem } from './dashboard-data'

const BRASS_CTA_STYLE = {
  background: 'linear-gradient(180deg, var(--accent-hover), var(--accent) 55%, var(--accent-dark))',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.22), 0 10px 22px -8px rgba(var(--accent-rgb),0.5), 0 0 0 1px rgba(var(--accent-rgb),0.25)',
}

export function GreetingBar({
  coachFirst,
  dateLine,
  greeting,
  next,
}: {
  coachFirst: string
  dateLine: string
  greeting: string
  next: { name: string; time: string } | null
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[26px] font-medium leading-none tracking-tight text-[var(--text-primary)]">
          {greeting}, {coachFirst}
        </h1>
        <p className="mt-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-dark)]">{dateLine}</p>
        {next ? (
          <p className="mt-2 text-[13px] text-[var(--text-tertiary)]">
            Next: <strong className="font-medium text-[var(--text-secondary)]">{next.name}</strong> at {next.time}
          </p>
        ) : null}
      </div>
      <Link
        href="/coach/schedule"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-[11px] px-4 py-2.5 text-[13px] font-semibold text-[#1a1206] transition-transform active:scale-[0.98]"
        style={BRASS_CTA_STYLE}
      >
        <Icon name="schedule" size={15} /> Book a session
      </Link>
    </div>
  )
}

export function TodayPanel({ items }: { items: TodayItem[] }) {
  return (
    <section className="gloss-panel overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-dark)]">
          Today{items.length ? ` · ${items.length} session${items.length === 1 ? '' : 's'}` : ''}
        </h2>
        <Link href="/coach/schedule" className="text-[12px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]">
          View schedule ›
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="px-4 pb-5 pt-1 text-[13px] text-[var(--text-tertiary)]">
          No sessions today.{' '}
          <Link href="/coach/schedule" className="text-[var(--accent)] hover:underline">
            Book one ›
          </Link>
        </div>
      ) : (
        <div className="coach-list-organic px-1 pb-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="min-w-[58px] font-display text-[13px] text-[var(--accent)]">{it.time}</span>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">{it.title}</div>
                <div className="truncate text-[11.5px] text-[var(--text-tertiary)]">{it.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function MessagesPeek({ items, unreadTotal }: { items: MessageItem[]; unreadTotal: number }) {
  return (
    <section className="gloss-panel overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-dark)]">Messages</h2>
        {unreadTotal > 0 ? <span className="text-[12px] text-[var(--text-tertiary)]">{unreadTotal} unread</span> : null}
      </div>
      {items.length === 0 ? (
        <div className="px-4 pb-5 pt-1 text-[13px] text-[var(--text-tertiary)]">All caught up.</div>
      ) : (
        <div className="coach-list-organic px-1">
          {items.map((m) => (
            <Link key={m.clientId} href="/coach/messages" className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">{m.name}</div>
                <div className="truncate text-[11.5px] text-[var(--text-tertiary)]">{m.preview}</div>
              </div>
              {m.unread > 0 ? (
                <span className="size-[7px] shrink-0 rounded-full bg-[var(--accent)]" style={{ boxShadow: '0 0 8px var(--accent)' }} />
              ) : null}
            </Link>
          ))}
        </div>
      )}
      <div className="px-4 pb-3 pt-1">
        <Link href="/coach/messages" className="text-[12px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]">
          All messages ›
        </Link>
      </div>
    </section>
  )
}

export function QuickActions() {
  const actions: { href: string; label: string; icon: InkedIconName }[] = [
    { href: '/coach/schedule', label: 'Book', icon: 'schedule' },
    { href: '/coach/messages', label: 'Message', icon: 'messages' },
    { href: '/coach/payments', label: 'Payment', icon: 'payments' },
  ]
  return (
    <div className="flex gap-2.5">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="flex flex-1 flex-col items-center gap-1.5 rounded-[11px] border border-[var(--border-default)] px-2 py-3 text-[11.5px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[rgba(var(--accent-rgb),0.3)] hover:text-[var(--text-primary)] [&_svg]:text-[var(--accent)]"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.02), transparent)' }}
        >
          <Icon name={a.icon} size={18} />
          {a.label}
        </Link>
      ))}
    </div>
  )
}
