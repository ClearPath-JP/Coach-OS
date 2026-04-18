'use client'

import { motion } from 'framer-motion'
import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function MotionButton({
  children,
  className,
  glow,
  disabled,
  onClick,
  type = 'button',
}: {
  children: ReactNode
  className?: string
  glow?: boolean
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
}) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors',
        disabled && 'pointer-events-none opacity-50',
        className
      )}
      {...(!disabled && {
        whileHover: {
          scale: 1.03,
          ...(glow ? { boxShadow: '0 0 16px rgba(127, 29, 29, 0.3)' } : {}),
        },
        whileTap: { scale: 0.95 },
      })}
      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
    >
      {children}
    </motion.button>
  )
}
