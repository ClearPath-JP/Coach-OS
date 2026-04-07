'use client'

import React from 'react'

export function DashboardTableShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--bg-app)',
        border: '1px solid var(--border-default)',
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
    active: {
      background: 'var(--success-bg)',
      color: 'var(--success)',
      border: '1px solid var(--success-border)',
    },
    pending: {
      background: 'var(--warning-bg)',
      color: 'var(--warning)',
      border: '1px solid var(--warning-border)',
    },
    inactive: {
      background: 'var(--bg-muted)',
      color: 'var(--text-tertiary)',
      border: '1px solid var(--border-default)',
    },
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
        ...s,
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
          background: 'var(--accent-light)',
          color: 'var(--accent)',
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
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{name}</div>
        {sub ? <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{sub}</div> : null}
      </div>
    </div>
  )
})
