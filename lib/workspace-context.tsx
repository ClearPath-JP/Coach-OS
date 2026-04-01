'use client'

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import type { WorkspaceSettings } from '@/lib/workspace-settings'

export type { WorkspaceSettings }

export interface WorkspaceContextValue {
  settings: WorkspaceSettings
  updateSettings: (partial: Partial<WorkspaceSettings>) => void
  refetchSettings: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({
  children,
  initialSettings,
}: {
  children: ReactNode
  initialSettings: WorkspaceSettings
}) {
  const [settings, setSettings] = useState(initialSettings)

  const updateSettings = useCallback(
    (partial: Partial<WorkspaceSettings>) => {
      setSettings((prev) => ({ ...prev, ...partial }))
    },
    []
  )

  const refetchSettings = useCallback(async () => {
    const res = await fetch('/api/settings', { credentials: 'include', cache: 'no-store' })
    if (res.ok) {
      const json = await res.json()
      setSettings({
        workspaceDisplayName: json.data?.workspace?.displayName ?? null,
        brandName: json.data?.workspace?.brandName ?? null,
        accentColor: json.data?.workspace?.accentColor ?? null,
        accentColorLight: json.data?.workspace?.accentColorLight ?? null,
        logoUrl: json.data?.workspace?.logoUrl ?? null,
      })
    }
  }, [])

  return (
    <WorkspaceContext.Provider
      value={{ settings, updateSettings, refetchSettings }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) {
    throw new Error('useWorkspace must be used inside WorkspaceProvider')
  }
  return ctx
}

