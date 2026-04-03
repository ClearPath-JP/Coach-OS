/** Dispatched by `CommandPalette` — call from nav search button etc. */
export const OPEN_COMMAND_PALETTE_EVENT = 'clearpath-open-command-palette'

export function openCommandPalette(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))
}
