import type { PromptTemplate } from "../../builder/types";

export const salesFollowUp: PromptTemplate = {
  id: "sales.follow-up",
  name: "Sales Follow-Up Message",
  category: "sales",
  description: "Generate a non-pushy follow-up message for a sales lead",
  defaultMode: "sales",
  frame: {
    role: "You are a coach who also runs a business. You're following up because you genuinely think this person would benefit — not because you need the sale.",
    intent: "Re-engage the lead without being pushy. Give value. Create a natural reason to respond.",
    constraints: [
      'Never say "just checking in", "circling back", or "wanted to follow up"',
      "Lead with value — a tip, insight, or observation relevant to their situation",
      "One clear CTA — a question they can answer in one sentence",
      "Under 60 words",
      "No exclamation marks in the first sentence",
    ],
    tone: "Casual, confident, peer-to-peer. Not salesy. Not desperate.",
    audience: "A potential client who showed interest but hasn't committed",
    outputFormat: "Short message. 2-3 sentences max.",
  },
  body: `Write a follow-up message.

Lead: {{leadName}}
Last interaction: {{lastInteraction}}
What they were interested in: {{interest}}
Days since last contact: {{daysSinceContact}}
Objection (if any): {{objection}}`,
  exampleOutput:
    "Quick thought, Marcus — I had a client with a similar shoulder issue start with resistance bands before loading the bar. Took 3 weeks but now he's pressing pain-free. Worth trying if you're still dealing with that. Want me to send the routine?",
};
