'use client'

import React from 'react'

export interface DashboardSectionHeaderProps {
  title: string
  subtitle?: string
  action?: { label: string; onClick: () => void }
  /** Tighter bottom margin when nested inside a card header row */
  dense?: boolean
}

export const DashboardSectionHeader = React.memo(function DashboardSectionHeader({
  title,
  subtitle,
  action,
  dense,
}: DashboardSectionHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: dense ? 0 : 14,
      }}
    >
      <div>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--cp-navy)',
            marginBottom: subtitle ? 2 : 0,
          }}
        >
          {title}
        </h2>
        {subtitle ? <p style={{ fontSize: 13, color: 'var(--cp-gray)', margin: 0 }}>{subtitle}</p> : null}
      </div>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--cp-accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          {action.label} →
        </button>
      ) : null}
    </div>
  )
})
