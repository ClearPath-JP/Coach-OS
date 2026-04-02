export type SessionActionItemRow = {
  id: string
  text: string
  assigned_to: 'client' | 'coach'
  completed: boolean
  completed_at: string | null
}

function isAssignedTo(v: unknown): v is 'client' | 'coach' {
  return v === 'client' || v === 'coach'
}

export function parseActionItemsJson(raw: unknown): SessionActionItemRow[] {
  if (!Array.isArray(raw)) return []
  const out: SessionActionItemRow[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    const text = typeof o.text === 'string' ? o.text : ''
    if (!id || !text) continue
    const assigned_to = isAssignedTo(o.assigned_to) ? o.assigned_to : 'client'
    out.push({
      id,
      text,
      assigned_to,
      completed: o.completed === true,
      completed_at: typeof o.completed_at === 'string' ? o.completed_at : null,
    })
  }
  return out
}

/** Preserve completion for client-assigned rows when coach saves an updated list. */
export function mergeIncomingActionItems(
  previous: SessionActionItemRow[],
  incoming: { id: string; text: string; assigned_to: 'client' | 'coach' }[]
): SessionActionItemRow[] {
  const prevById = new Map(previous.map((r) => [r.id, r]))
  return incoming.map((row) => {
    const old = prevById.get(row.id)
    const keepCompletion =
      old &&
      old.assigned_to === 'client' &&
      row.assigned_to === 'client' &&
      old.completed === true
    return {
      id: row.id,
      text: row.text,
      assigned_to: row.assigned_to,
      completed: keepCompletion ? true : false,
      completed_at: keepCompletion ? old.completed_at : null,
    }
  })
}

export function toDbRowsFromCoachInput(
  items: { id: string; text: string; assignedTo: 'client' | 'coach' }[]
): { id: string; text: string; assigned_to: 'client' | 'coach' }[] {
  return items.map((i) => ({
    id: i.id,
    text: i.text,
    assigned_to: i.assignedTo,
  }))
}
