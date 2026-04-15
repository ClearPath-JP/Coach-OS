// Prompt Intelligence Layer — ClearPath Solutions
// Structured prompt framing system for all AI interactions

export { buildPrompt, enhancePrompt } from "./builder";
export { getMode, getModeNames } from "./modes";
export { findTemplate, getTemplateIds, getTemplatesByCategory } from "./templates";

export type {
  PromptFrame,
  PromptContext,
  FramingMode,
  TemplateCategory,
  PromptTemplate,
  AssembledPrompt,
  BuilderInput,
  ModeConfig,
} from "./builder/types";
