import type { LeadResult } from './lead-research'

export type LeadStatus = 'new' | 'contacted' | 'replied' | 'converted' | 'not_interested'
export const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'replied', 'converted', 'not_interested']

export type LeadInteraction = {
  lead_key: string
  status: LeadStatus
  notes: string | null
  saved_client_id: string | null
}

/** Stable id for a lead so status/notes persist across re-searches. */
export function normalizeLeadKey(lead: Pick<LeadResult, 'platform' | 'handle' | 'url'>): string {
  const handle = (lead.handle ?? '').trim().replace(/^@/, '').toLowerCase()
  if (handle) return `${lead.platform}:${handle}`
  const url = (lead.url ?? '')
    .trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')
  return `${lead.platform}:${url}`
}
