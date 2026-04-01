'use client'

import { useEffect, useState } from 'react'
import { ClearPathLogo } from '@/components/layout/ClearPathLogo'

export function AppLoadingScreen() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = window.setTimeout(() => setVisible(false), 550)
    return () => window.clearTimeout(t)
  }, [])

  if (!visible) return null
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--bg-app)] transition-opacity">
      <div className="app-logo-pulse">
        <ClearPathLogo size={40} />
      </div>
      <p className="mt-3 text-[15px] font-semibold text-[var(--text-primary)]">ClearPath</p>
    </div>
  )
}
