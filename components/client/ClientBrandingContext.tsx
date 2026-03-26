'use client'

import { createContext, useContext } from 'react'

export type ClientBrandingContextValue = {
  brandName: string | null
  workspaceId: string | null
  /** Resolved from clients row for top nav */
  userDisplayName: string | null
}

const ClientBrandingContext = createContext<ClientBrandingContextValue>({
  brandName: null,
  workspaceId: null,
  userDisplayName: null,
})

export function ClientBrandingProvider({
  value,
  children,
}: {
  value: ClientBrandingContextValue
  children: React.ReactNode
}) {
  return <ClientBrandingContext.Provider value={value}>{children}</ClientBrandingContext.Provider>
}

export function useClientBranding() {
  return useContext(ClientBrandingContext)
}
