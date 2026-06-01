'use client'

/**
 * Bulk-action bar — shown when one or more leads are selected.
 * Purely presentational; parent is responsible for all data operations.
 */

import { Download, Mail, Trash2, UserPlus, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LeadBulkBarProps {
  count: number
  onExportCsv: () => void
  onMarkContacted: () => void
  onAddToClients: () => void
  onDeleteSelected: () => void
  onClear: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeadBulkBar({
  count,
  onExportCsv,
  onMarkContacted,
  onAddToClients,
  onDeleteSelected,
  onClear,
}: LeadBulkBarProps) {
  if (count === 0) return null

  return (
    <div
      role="toolbar"
      aria-label={`${count} lead${count === 1 ? '' : 's'} selected`}
      className={
        'flex flex-wrap items-center gap-2 rounded-xl ' +
        'border border-[var(--accent)]/30 bg-[var(--accent)]/5 ' +
        'px-4 py-2.5'
      }
    >
      {/* Selection count */}
      <span className="text-xs font-semibold text-[var(--accent)] mr-1">
        {count} selected
      </span>

      {/* Export CSV */}
      <button
        type="button"
        onClick={onExportCsv}
        className={
          'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] ' +
          'bg-[var(--bg-app)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] ' +
          'transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]'
        }
      >
        <Download className="size-3" />
        Export CSV
      </button>

      {/* Mark as contacted */}
      <button
        type="button"
        onClick={onMarkContacted}
        className={
          'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] ' +
          'bg-[var(--bg-app)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] ' +
          'transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]'
        }
      >
        <Mail className="size-3" />
        Mark as Contacted
      </button>

      {/* Add to clients */}
      <button
        type="button"
        onClick={onAddToClients}
        className={
          'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] ' +
          'bg-[var(--bg-app)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] ' +
          'transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]'
        }
      >
        <UserPlus className="size-3" />
        Add to clients
      </button>

      {/* Delete selected */}
      <button
        type="button"
        onClick={onDeleteSelected}
        className={
          'inline-flex items-center gap-1.5 rounded-lg border border-[var(--error-border,#f87171)]/30 ' +
          'bg-[var(--bg-app)] px-2.5 py-1 text-xs font-medium text-[var(--error,#f87171)] ' +
          'transition-colors hover:border-[var(--error,#f87171)]/50 hover:bg-[var(--error,#f87171)]/5'
        }
      >
        <Trash2 className="size-3" />
        Delete selected
      </button>

      {/* Spacer */}
      <span className="flex-1" />

      {/* Clear selection */}
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className={
          'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs ' +
          'text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]'
        }
      >
        <X className="size-3.5" />
        Clear
      </button>
    </div>
  )
}
