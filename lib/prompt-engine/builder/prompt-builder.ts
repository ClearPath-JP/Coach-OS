import type {
  BuilderInput,
  AssembledPrompt,
  PromptFrame,
  ModeConfig,
} from "./types";
import { getMode } from "../modes";
import { findTemplate } from "../templates";

/**
 * Main prompt builder. Takes user intent + context + mode and produces
 * a structured, high-performance prompt split into system and user parts.
 *
 * Usage:
 *   const prompt = buildPrompt({
 *     intent: "coaching.client-checkin",
 *     context: { data: { clientName: "Sarah", ... } },
 *   });
 *   // prompt.systemPrompt → send as system message
 *   // prompt.userPrompt   → send as user message
 */
export function buildPrompt(input: BuilderInput): AssembledPrompt {
  // 1. Resolve template if intent matches a template ID
  const template = findTemplate(input.intent);

  // 2. Resolve framing mode: explicit override > template default > expert fallback
  const modeName = input.mode ?? template?.defaultMode ?? "expert";
  const modeConfig = getMode(modeName);

  // 3. Build frame by layering: mode defaults → template frame → caller overrides
  const frame = mergeFrames(modeConfig, template?.frame, input.overrides);

  // 4. Inject context variables into the frame (role may have {{businessName}}, etc.)
  const hydratedFrame = hydrateFrame(frame, input.context?.data);

  // 5. Assemble system prompt from the hydrated frame
  const systemPrompt = assembleSystemPrompt(hydratedFrame);

  // 6. Assemble user prompt from template body + context
  const userPrompt = assembleUserPrompt(template?.body, input);

  return {
    systemPrompt,
    userPrompt,
    metadata: {
      templateId: template?.id,
      mode: modeName,
      contextKeys: Object.keys(input.context?.data ?? {}),
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Merges three frame layers with correct precedence:
 * overrides > template > mode defaults
 */
function mergeFrames(
  mode: ModeConfig,
  template?: Partial<PromptFrame>,
  overrides?: Partial<PromptFrame>
): PromptFrame {
  return {
    role: overrides?.role ?? template?.role ?? mode.role ?? "",
    intent: overrides?.intent ?? template?.intent ?? "",
    constraints: [
      ...(mode.constraints ?? []),
      ...(template?.constraints ?? []),
      ...(overrides?.constraints ?? []),
    ],
    tone: overrides?.tone ?? template?.tone ?? mode.tone ?? "",
    audience: overrides?.audience ?? template?.audience ?? "",
    outputFormat:
      overrides?.outputFormat ?? template?.outputFormat ?? "",
  };
}

/** Replace {{variable}} placeholders in all string fields of the frame */
function hydrateFrame(
  frame: PromptFrame,
  data?: Record<string, unknown>
): PromptFrame {
  if (!data) return frame;

  const hydrate = (str: string): string => {
    let result = str;
    for (const [key, value] of Object.entries(data)) {
      result = result.replaceAll(`{{${key}}}`, String(value ?? ""));
    }
    return result;
  };

  return {
    role: hydrate(frame.role),
    intent: hydrate(frame.intent),
    constraints: frame.constraints.map(hydrate),
    tone: hydrate(frame.tone),
    audience: hydrate(frame.audience),
    outputFormat: hydrate(frame.outputFormat),
  };
}

/** Converts a PromptFrame into a structured system prompt string */
function assembleSystemPrompt(frame: PromptFrame): string {
  const sections: string[] = [];

  if (frame.role) {
    sections.push(`## Role\n${frame.role}`);
  }
  if (frame.intent) {
    sections.push(`## Intent\n${frame.intent}`);
  }
  if (frame.tone) {
    sections.push(`## Tone\n${frame.tone}`);
  }
  if (frame.audience) {
    sections.push(`## Audience\n${frame.audience}`);
  }
  if (frame.constraints.length > 0) {
    const rules = frame.constraints.map((c) => `- ${c}`).join("\n");
    sections.push(`## Rules\n${rules}`);
  }
  if (frame.outputFormat) {
    sections.push(`## Output Format\n${frame.outputFormat}`);
  }

  return sections.join("\n\n");
}

/** Builds the user-facing prompt from template body + context injection */
function assembleUserPrompt(
  templateBody: string | undefined,
  input: BuilderInput
): string {
  let prompt = templateBody ?? input.intent;

  // Inject context variables: {{clientName}} → actual value
  if (input.context?.data) {
    for (const [key, value] of Object.entries(input.context.data)) {
      prompt = prompt.replaceAll(`{{${key}}}`, String(value ?? ""));
    }
  }

  // Prepend prior context if available
  if (input.context?.priorContext) {
    prompt = `Context from previous interaction:\n${input.context.priorContext}\n\n${prompt}`;
  }

  // Append priority signal if urgent
  if (input.context?.priority === "urgent") {
    prompt += "\n\nIMPORTANT: This is urgent — prioritize speed and directness.";
  }

  return prompt;
}
