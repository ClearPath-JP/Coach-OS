'use client'

import { createContext, useContext } from 'react'

export type ClientBrandingContextValue = {
  brandName: string | null
  brandTagline: string | null
  workspaceId: string | null
  /** Resolved from clients row for top nav */
  userDisplayName: string | null
  logoUrl: string | null
  /** Coerced Phase-4 whitelist hex for `--cp-accent` */
  accentColor: string | null
}

const ClientBrandingContext = createContext<ClientBrandingContextValue>({
  brandName: null,
  brandTagline: null,
  workspaceId: null,
  userDisplayName: null,
  logoUrl: null,
  accentColor: null,
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
