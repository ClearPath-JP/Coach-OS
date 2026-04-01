'use client'

import { useMemo, useState } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

export type DataColumn<T> = {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  sortValue?: (row: T) => string | number
  className?: string
}

export function DataTable<T>({
  rows,
  columns,
  loading = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
  selectable = false,
  rowHref,
  rowClassName,
}: {
  rows: T[]
  columns: DataColumn<T>[]
  loading?: boolean
  emptyTitle: string
  emptyDescription: string
  emptyAction?: React.ReactNode
  selectable?: boolean
  rowHref?: (row: T) => string | null
  rowClassName?: (row: T) => string
}) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const resolved = useMemo(() => {
    const copy = [...rows]
    const col = columns.find((c) => c.key === sortKey && c.sortValue)
    if (!col?.sortValue) return copy
    return copy.sort((a, b) => {
      const av = col.sortValue!(a)
      const bv = col.sortValue!(b)
      const aa = typeof av === 'number' ? av : String(av).toLowerCase()
      const bb = typeof bv === 'number' ? bv : String(bv).toLowerCase()
      if (aa < bb) return sortDir === 'asc' ? -1 : 1
      if (aa > bb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [rows, columns, sortKey, sortDir])

  const onSort = (key: string, sortable: boolean) => {
    if (!sortable) return
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir('asc')
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-app)]">
      <div className="max-h-[65vh] overflow-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 bg-[var(--bg-app)]">
            <tr className="h-9 border-b border-[var(--border-subtle)]">
              {selectable ? <th className="w-10 px-3"><input type="checkbox" aria-label="Select all" /></th> : null}
              {columns.map((col) => {
                const sortable = Boolean(col.sortValue)
                const active = sortKey === col.key
                return (
                  <th key={col.key} className={cn('px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]', col.className)}>
                    <button
                      type="button"
                      className={cn('inline-flex items-center gap-1', sortable ? 'cursor-pointer' : 'cursor-default')}
                      onClick={() => onSort(col.key, sortable)}
                    >
                      <span>{col.header}</span>
                      {sortable ? (
                        <span className={cn('text-[10px]', active ? 'text-[var(--accent)]' : 'text-[var(--text-quaternary)]')}>
                          {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      ) : null}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`s-${i}`} className="h-12 border-b border-[var(--border-subtle)]">
                    {selectable ? <td className="px-3"><Skeleton className="h-4 w-4" /></td> : null}
                    {columns.map((col) => (
                      <td key={`${col.key}-${i}`} className="px-3"><Skeleton className="h-4 w-3/4" /></td>
                    ))}
                  </tr>
                ))
              : resolved.map((row, idx) => {
                  const href = rowHref?.(row)
                  return (
                    <tr
                      key={idx}
                      className={cn(
                        'h-12 border-b border-[var(--border-subtle)] transition-colors duration-[100ms] hover:bg-[var(--bg-subtle)]',
                        href && 'cursor-pointer',
                        rowClassName?.(row)
                      )}
                      onClick={() => {
                        if (href) window.location.href = href
                      }}
                    >
                      {selectable ? <td className="px-3"><input type="checkbox" aria-label="Select row" /></td> : null}
                      {columns.map((col) => <td key={`${col.key}-${idx}`} className={cn('px-3 text-[14px] text-[var(--text-primary)]', col.className)}>{col.render(row)}</td>)}
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
      {!loading && resolved.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{emptyTitle}</p>
          <p className="mx-auto mt-2 max-w-[340px] text-[14px] leading-[1.6] text-[var(--text-tertiary)]">{emptyDescription}</p>
          {emptyAction ? <div className="mt-6">{emptyAction}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
