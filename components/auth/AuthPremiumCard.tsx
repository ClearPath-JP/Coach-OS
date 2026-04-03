import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function AuthPremiumCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('login-premium-card', className)}>{children}</div>
}
