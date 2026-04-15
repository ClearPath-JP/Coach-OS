import type { FramingMode, ModeConfig } from "../builder/types";
import { expertMode } from "./expert";
import { salesMode } from "./sales";
import { analyticalMode } from "./analytical";
import { teacherMode } from "./teacher";
import { challengerMode } from "./challenger";
import { receptionistMode } from "./receptionist";

const modes: Record<FramingMode, ModeConfig> = {
  expert: expertMode,
  sales: salesMode,
  analytical: analyticalMode,
  teacher: teacherMode,
  challenger: challengerMode,
  receptionist: receptionistMode,
};

/** Returns the frame configuration for a named framing mode */
export function getMode(name: FramingMode): ModeConfig {
  return modes[name] ?? modes.expert;
}

/** Returns all available mode names */
export function getModeNames(): FramingMode[] {
  return Object.keys(modes) as FramingMode[];
}
