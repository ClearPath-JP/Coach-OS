import { cn } from '@/lib/utils'

export interface SkeletonProps {
  className?: string
  width?: string
  height?: string
}

export function Skeleton({ className, width, height }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton rounded-md', className)}
      style={{ width, height }}
    />
  )
}
