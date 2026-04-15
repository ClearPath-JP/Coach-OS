import type { BuilderInput, AssembledPrompt, FramingMode } from "./types";
import { buildPrompt } from "./prompt-builder";

/**
 * Takes a raw, weak prompt and transforms it into a structured,
 * high-performance prompt using the framing stack.
 *
 * This is the "magic upgrade" function — useful when prompts come
 * from user input, automation triggers, or legacy integrations.
 *
 * Usage:
 *   const prompt = enhancePrompt("write a message to my client", {
 *     clientName: "Sarah",
 *     lastSession: "Monday",
 *   });
 */
export function enhancePrompt(
  rawPrompt: string,
  context?: Record<string, unknown>
): AssembledPrompt {
  // 1. Detect intent category from keywords
  const category = detectCategory(rawPrompt);

  // 2. Select optimal framing mode for this category
  const mode = detectMode(rawPrompt, category);

  // 3. Build structured input with enhancement constraints
  const input: BuilderInput = {
    intent: rawPrompt,
    mode,
    context: context ? { data: context } : undefined,
    overrides: {
      constraints: [
        "Be specific — reference the context provided",
        "Be concise — say what needs to be said, nothing more",
        "Include a clear next step or action item",
      ],
    },
  };

  // 4. Run through the builder engine
  return buildPrompt(input);
}

/** Keyword signals for each category */
const CATEGORY_SIGNALS: Record<string, string[]> = {
  sales: [
    "follow up",
    "prospect",
    "lead",
    "close",
    "deal",
    "pitch",
    "proposal",
    "pricing",
    "convert",
    "trial",
  ],
  coaching: [
    "client",
    "session",
    "progress",
    "check-in",
    "checkin",
    "program",
    "workout",
    "training",
    "coach",
    "student",
  ],
  support: [
    "help",
    "issue",
    "problem",
    "question",
    "ticket",
    "bug",
    "complaint",
    "support",
    "fix",
    "error",
  ],
  analytics: [
    "data",
    "report",
    "metric",
    "trend",
    "dashboard",
    "growth",
    "revenue",
    "analyze",
    "insight",
    "numbers",
  ],
  content: [
    "post",
    "article",
    "blog",
    "email",
    "newsletter",
    "social",
    "caption",
    "content",
    "write",
    "copy",
  ],
  receptionist: [
    "call",
    "phone",
    "booking",
    "appointment",
    "schedule",
    "availability",
    "reception",
    "caller",
  ],
};

/** Category-to-mode mapping */
const CATEGORY_MODE_MAP: Record<string, FramingMode> = {
  sales: "sales",
  coaching: "expert",
  support: "teacher",
  analytics: "analytical",
  content: "expert",
  receptionist: "receptionist",
};

/** Challenge signal keywords that override the default mode */
const CHALLENGE_SIGNALS = [
  "honest",
  "critique",
  "what's wrong",
  "whats wrong",
  "push back",
  "challenge",
  "devil's advocate",
  "risks",
  "blind spot",
];

/**
 * Classifies a raw prompt into a category based on keyword matching.
 * Returns "coaching" as default (primary ClearPath use case).
 */
export function detectCategory(prompt: string): string {
  const lower = prompt.toLowerCase();
  let bestCategory = "coaching";
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_SIGNALS)) {
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

/**
 * Selects the optimal framing mode based on the prompt and its category.
 * Challenge signals override the default category-based mode.
 */
export function detectMode(prompt: string, category: string): FramingMode {
  const lower = prompt.toLowerCase();

  // Challenge signals override everything
  if (CHALLENGE_SIGNALS.some((signal) => lower.includes(signal))) {
    return "challenger";
  }

  return CATEGORY_MODE_MAP[category] ?? "expert";
}
