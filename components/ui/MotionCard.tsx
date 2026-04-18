'use client'

import { motion } from 'framer-motion'
import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function MotionCard({
  children,
  className,
  isStatic,
  onClick,
}: {
  children: ReactNode
  className?: string
  isStatic?: boolean
  onClick?: () => void
}) {
  return (
    <motion.div
      className={cn(
        'rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]',
        className
      )}
      onClick={onClick}
      {...(!isStatic && {
        whileHover: { y: -3, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' },
        whileTap: { scale: 0.985 },
      })}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {children}
    </motion.div>
  )
}
