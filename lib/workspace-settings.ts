/** Shared workspace branding shape (server + client). Keep in a non–client module so RSC layouts can compute provider keys. */

export interface WorkspaceSettings {
  workspaceDisplayName: string | null
  brandName: string | null
  accentColor: string | null
  accentColorLight: string | null
  logoUrl: string | null
  stanceId: string | null
}

/** Use as `key` on `WorkspaceProvider` so client state resets when the server layout passes new branding. */
export function workspaceProviderKey(initialSettings: WorkspaceSettings): string {
  return [
    initialSettings.workspaceDisplayName,
    initialSettings.brandName,
    initialSettings.accentColor,
    initialSettings.accentColorLight,
    initialSettings.logoUrl,
    initialSettings.stanceId,
  ].join('\0')
}
