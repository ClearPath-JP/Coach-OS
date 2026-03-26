import { cn } from '@/lib/utils'

export interface SkeletonProps {
  className?: string
  width?: string
  height?: string
}

export function Skeleton({ className, width, height }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-[var(--color-surface-2)]',
        className
      )}
      style={{ width, height }}
    />
  )
}
