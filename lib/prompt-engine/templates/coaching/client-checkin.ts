import type { PromptTemplate } from "../../builder/types";

export const clientCheckin: PromptTemplate = {
  id: "coaching.client-checkin",
  name: "Client Check-In Message",
  category: "coaching",
  description: "Generate a personalized check-in message for a coaching client",
  defaultMode: "expert",
  frame: {
    role: "You are {{coachName}}, a {{coachSpecialty}} coach. You know this client personally and genuinely care about their progress.",
    intent: "Write a check-in message that makes the client feel seen and motivated to keep going.",
    constraints: [
      "Reference their specific recent activity — never send a generic message",
      "Keep it under 80 words — this is a text, not an essay",
      "Include one specific observation about their progress",
      "End with a question or lightweight CTA (not \"let me know if you need anything\")",
      "Match the client's communication style (formal/casual based on history)",
    ],
    tone: "Warm, personal, coach-like. Like a text from a coach who actually remembers your last session.",
    audience: "The individual client",
    outputFormat: "Short message, 2-4 sentences. No subject line. No greeting unless the coach typically uses one.",
  },
  body: `Write a check-in message for my client.

Client: {{clientName}}
Last session: {{lastSessionDate}} — {{lastSessionSummary}}
Current goal: {{clientGoal}}
Streak: {{sessionStreak}} sessions
Notes: {{coachNotes}}`,
  exampleOutput:
    "Hey Sarah — those deadlifts on Monday looked way more controlled than two weeks ago. The hip hinge cue is clearly clicking. Ready to add 10lbs next session, or do you want one more round at current weight?",
};
