'use client'

import Link from 'next/link'
import { Icon, type InkedIconName } from '@/components/icons/inked'
import type { TodayItem, MessageItem } from './dashboard-data'

// Belt colors rotate per session row so the schedule reads like the Arcade mockup.
const SESSION_BELTS = [
  { tile: 'tile-yellow', bar: 'var(--belt-yellow)' },
  { tile: 'tile-teal', bar: 'var(--belt-teal)' },
  { tile: 'tile-violet', bar: 'var(--belt-violet)' },
  { tile: 'tile-blue', bar: 'var(--belt-blue)' },
] as const

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
    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {dateLine ? (
          <div className="mb-1 font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            {dateLine}
          </div>
        ) : (
          <div className="mb-1 h-[14px]" />
        )}
        <h1 className="font-[family-name:var(--font-display)] text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em] text-[var(--text-primary)] sm:text-[40px]">
          {greeting ? `${greeting}, ${coachFirst}` : ` `} <span aria-hidden>👊</span>
        </h1>
        {next ? (
          <p className="mt-1.5 font-[family-name:var(--font-display)] text-[14px] font-medium text-[var(--text-tertiary)]">
            Next up: <strong className="font-bold text-[var(--text-primary)]">{next.name}</strong> at {next.time}
          </p>
        ) : null}
      </div>
      <Link
        href="/coach/schedule"
        className="btn-primary-gloss inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border-[3px] border-[var(--border-default)] px-[18px] py-[9px] font-[family-name:var(--font-display)] text-[13px] font-bold text-[var(--text-on-accent)] transition-transform hover:-translate-y-px active:translate-y-0"
      >
        <Icon name="schedule" size={15} /> Book session
      </Link>
    </div>
  )
}

export function TodayPanel({ items }: { items: TodayItem[] }) {
  return (
    <section className="card-gloss rounded-[16px] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Today
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-[17px] font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">
            Schedule{items.length ? ` · ${items.length}` : ''}
          </h2>
        </div>
        <Link href="/coach/schedule" className="arcade-badge arcade-badge-teal">
          View full week →
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="rounded-[12px] border-[3px] border-dashed border-[var(--border-default)] px-4 py-6 text-center font-[family-name:var(--font-display)] text-[13px] font-medium text-[var(--text-tertiary)]">
          No sessions today.{' '}
          <Link href="/coach/schedule" className="font-bold text-[var(--text-primary)] underline">
            Book one →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((it, i) => {
            const belt = SESSION_BELTS[i % SESSION_BELTS.length]!
            const [time, ampm] = splitTime(it.time)
            return (
              <div
                key={it.id}
                className="flex items-center gap-3.5 rounded-[12px] border-[3px] border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-3 shadow-[var(--shadow-sm)] transition-transform hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-md)]"
              >
                <div
                  className={`${belt.tile} shrink-0 px-1 py-1.5 text-center`}
                  style={{ width: 54, boxShadow: 'none', borderRadius: 10 }}
                >
                  <div className="font-[family-name:var(--font-display)] text-[15px] font-extrabold leading-none">{time}</div>
                  <div className="font-[family-name:var(--font-display)] text-[10px] font-bold tracking-[0.05em]">{ampm}</div>
                </div>
                <div
                  className="self-stretch rounded-[2px] border-[1.5px] border-[var(--border-default)]"
                  style={{ width: 3, background: belt.bar }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-[family-name:var(--font-display)] text-[14px] font-bold text-[var(--text-primary)]">
                    {it.title}
                  </div>
                  <div className="truncate font-[family-name:var(--font-display)] text-[12px] font-medium text-[var(--text-tertiary)]">
                    {it.sub}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function MessagesPeek({ items, unreadTotal }: { items: MessageItem[]; unreadTotal: number }) {
  return (
    <section className="card-gloss rounded-[16px] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Inbox
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-[17px] font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">
            Messages
          </h2>
        </div>
        {unreadTotal > 0 ? <span className="arcade-badge arcade-badge-coral">{unreadTotal} unread</span> : null}
      </div>
      {items.length === 0 ? (
        <div className="rounded-[12px] border-[3px] border-dashed border-[var(--border-default)] px-4 py-5 text-center font-[family-name:var(--font-display)] text-[13px] font-medium text-[var(--text-tertiary)]">
          All caught up. 🥋
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((m) => (
            <Link
              key={m.clientId}
              href="/coach/messages"
              className="flex items-center gap-3 rounded-[10px] border-2 border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2.5 transition-transform hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-xs)]"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-[family-name:var(--font-display)] text-[13px] font-bold text-[var(--text-primary)]">
                  {m.name}
                </div>
                <div className="truncate font-[family-name:var(--font-display)] text-[12px] font-medium text-[var(--text-tertiary)]">
                  {m.preview}
                </div>
              </div>
              {m.unread > 0 ? (
                <span className="shrink-0 rounded-full border-2 border-[var(--border-default)] bg-[var(--belt-coral)] px-[7px] py-px font-[family-name:var(--font-display)] text-[10px] font-extrabold text-white">
                  {m.unread}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      )}
      <div className="mt-3">
        <Link
          href="/coach/messages"
          className="font-[family-name:var(--font-display)] text-[12px] font-bold text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
        >
          All messages →
        </Link>
      </div>
    </section>
  )
}

export function QuickActions() {
  const actions: { href: string; label: string; sub: string; icon: InkedIconName; tile: string }[] = [
    { href: '/coach/invoices', label: 'New invoice', sub: 'Send a payment request', icon: 'invoices', tile: 'tile-yellow' },
    { href: '/coach/clients', label: 'Add client', sub: 'Invite to your dojo', icon: 'clients', tile: 'tile-teal' },
    { href: '/coach/payments', label: 'Collect payment', sub: 'Record what came in', icon: 'payments', tile: 'tile-blue' },
    { href: '/coach/messages', label: 'Message', sub: 'Reach your students', icon: 'messages', tile: 'tile-violet' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="flex items-center gap-3 rounded-[16px] border-[3px] border-[var(--border-default)] bg-[var(--bg-subtle)] p-4 shadow-[var(--shadow-sm)] transition-transform hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-md)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <span
            className={`${a.tile} flex size-10 shrink-0 items-center justify-center text-[var(--text-primary)]`}
            style={{ borderRadius: 10, boxShadow: 'none' }}
          >
            <Icon name={a.icon} size={18} />
          </span>
          <div className="min-w-0">
            <div className="truncate font-[family-name:var(--font-display)] text-[13px] font-bold text-[var(--text-primary)]">
              {a.label}
            </div>
            <div className="truncate font-[family-name:var(--font-display)] text-[12px] font-medium text-[var(--text-tertiary)]">
              {a.sub}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

/** "9:00 AM" → ["9:00", "AM"]; tolerant of unexpected formats. */
function splitTime(t: string): [string, string] {
  const m = t.match(/^(.*?)\s*(AM|PM)$/i)
  if (m) return [m[1]?.trim() ?? '', m[2]?.toUpperCase() ?? '']
  return [t, '']
}
