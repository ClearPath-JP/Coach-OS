'use client'

import React from 'react'

export function DashboardTableShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--cp-white)',
        border: '1px solid var(--cp-border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}

export function DashboardTable({ children }: { children: React.ReactNode }) {
  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 14,
      }}
    >
      {children}
    </table>
  )
}

export const StatusBadge = React.memo(function StatusBadge({ status }: { status: 'active' | 'pending' | 'inactive' }) {
  const styles = {
    active: { bg: '#DCFCE7', text: '#15803D' },
    pending: { bg: '#FEF9C3', text: '#854D0E' },
    inactive: { bg: 'var(--cp-offwhite)', text: 'var(--cp-gray)' },
  }
  const s = styles[status]
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        background: s.bg,
        color: s.text,
      }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
})

export const AvatarCell = React.memo(function AvatarCell({ name, sub }: { name: string; sub?: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: 'var(--cp-lavender)',
          color: 'var(--cp-royal)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
      <div>
        <div style={{ fontWeight: 600, color: 'var(--cp-navy)', fontSize: 14 }}>{name}</div>
        {sub ? <div style={{ fontSize: 12, color: 'var(--cp-gray)' }}>{sub}</div> : null}
      </div>
    </div>
  )
})
