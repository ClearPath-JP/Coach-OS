'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/coach/studio/projects', label: 'Projects' },
  { href: '/coach/studio/scheduled', label: 'Scheduled' },
]

export function StudioTabs() {
  const path = usePathname()
  return (
    <div className="mb-4 flex gap-1 border-b border-white/10">
      {TABS.map((t) => {
        const active = path === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-2 text-sm font-medium ${active ? 'border-b-2 border-[var(--accent)] text-white' : 'text-white/60 hover:text-white'}`}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
