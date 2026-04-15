import type { PromptTemplate } from "../builder/types";
import { clientCheckin } from "./coaching/client-checkin";
import { salesFollowUp } from "./sales/follow-up";
import { inboundCall } from "./receptionist/inbound-call";

/** All registered templates, keyed by ID */
const templates: Record<string, PromptTemplate> = {
  [clientCheckin.id]: clientCheckin,
  [salesFollowUp.id]: salesFollowUp,
  [inboundCall.id]: inboundCall,
};

/**
 * Find a template by exact ID match.
 * Returns undefined if no template matches.
 */
export function findTemplate(id: string): PromptTemplate | undefined {
  return templates[id];
}

/** Returns all registered template IDs */
export function getTemplateIds(): string[] {
  return Object.keys(templates);
}

/** Returns all templates for a given category */
export function getTemplatesByCategory(
  category: string
): PromptTemplate[] {
  return Object.values(templates).filter((t) => t.category === category);
}
