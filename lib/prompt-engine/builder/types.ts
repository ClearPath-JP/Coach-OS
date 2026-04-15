/** The six framing dimensions that control LLM output quality */
export interface PromptFrame {
  /** WHO is speaking — activates domain-specific vocabulary and reasoning */
  role: string;
  /** WHAT they're trying to accomplish */
  intent: string;
  /** WHAT rules they follow — prunes output space, forces density */
  constraints: string[];
  /** HOW they sound — shifts word choice, hedging, formality */
  tone: string;
  /** WHO they're speaking to — selects complexity band */
  audience: string;
  /** WHAT shape the response takes */
  outputFormat: string;
}

/** Context data injected into the prompt */
export interface PromptContext {
  /** Key-value pairs of relevant data (client info, session data, etc.) */
  data: Record<string, unknown>;
  /** Optional summary of prior interaction for continuity */
  priorContext?: string;
  /** Optional urgency signal */
  priority?: "low" | "normal" | "high" | "urgent";
}

/** Named framing mode that preconfigures tone, structure, and depth */
export type FramingMode =
  | "expert"
  | "sales"
  | "analytical"
  | "teacher"
  | "challenger"
  | "receptionist";

/** Template category for classification */
export type TemplateCategory =
  | "coaching"
  | "sales"
  | "support"
  | "analytics"
  | "content"
  | "receptionist";

/** A complete prompt template definition */
export interface PromptTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  defaultMode: FramingMode;
  frame: PromptFrame;
  /** Mustache-style variable slots: {{clientName}}, {{lastSession}}, etc. */
  body: string;
  /** Example output for testing/validation */
  exampleOutput?: string;
}

/** The assembled, ready-to-send prompt */
export interface AssembledPrompt {
  systemPrompt: string;
  userPrompt: string;
  metadata: {
    templateId?: string | undefined;
    mode: FramingMode;
    contextKeys: string[];
    timestamp: string;
  };
}

/** Input to the prompt builder */
export interface BuilderInput {
  /** What the user wants to do — natural language or template ID */
  intent: string;
  /** Raw context data from the application */
  context?: PromptContext | undefined;
  /** Override the default framing mode */
  mode?: FramingMode | undefined;
  /** Override specific frame dimensions */
  overrides?: Partial<PromptFrame> | undefined;
}

/** Mode configuration — partial frame that gets merged */
export type ModeConfig = Partial<PromptFrame>;
