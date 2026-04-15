import { buildPrompt } from "../builder/prompt-builder";
import type { BuilderInput } from "../builder/types";

describe("buildPrompt", () => {
  it("builds a prompt from a template ID with context", () => {
    const input: BuilderInput = {
      intent: "coaching.client-checkin",
      context: {
        data: {
          coachName: "JP",
          coachSpecialty: "martial arts",
          clientName: "Sarah",
          lastSessionDate: "Monday",
          lastSessionSummary: "completed 4/5 exercises",
          clientGoal: "first BJJ competition",
          sessionStreak: "6",
          coachNotes: "hip hinge improving",
        },
      },
    };

    const result = buildPrompt(input);

    // System prompt should contain the hydrated role
    expect(result.systemPrompt).toContain("JP");
    expect(result.systemPrompt).toContain("martial arts");
    // Should include mode constraints (expert mode is default for coaching)
    expect(result.systemPrompt).toContain("Rules");
    // Should include template constraints
    expect(result.systemPrompt).toContain("under 80 words");
    // User prompt should have context injected
    expect(result.userPrompt).toContain("Sarah");
    expect(result.userPrompt).toContain("Monday");
    expect(result.userPrompt).toContain("hip hinge improving");
    // Metadata should track template
    expect(result.metadata.templateId).toBe("coaching.client-checkin");
    expect(result.metadata.mode).toBe("expert");
    expect(result.metadata.contextKeys).toContain("clientName");
  });

  it("builds a prompt with explicit mode override", () => {
    const input: BuilderInput = {
      intent: "coaching.client-checkin",
      mode: "challenger",
      context: {
        data: {
          coachName: "JP",
          coachSpecialty: "conditioning",
          clientName: "Marcus",
          lastSessionDate: "Wednesday",
          lastSessionSummary: "skipped leg day",
          clientGoal: "strength gains",
          sessionStreak: "2",
          coachNotes: "needs accountability",
        },
      },
    };

    const result = buildPrompt(input);

    // Template role wins over mode role, but challenger constraints are merged
    expect(result.systemPrompt).toContain("Identify at least one assumption");
    expect(result.metadata.mode).toBe("challenger");
  });

  it("builds a prompt from raw intent (no template match)", () => {
    const input: BuilderInput = {
      intent: "write a motivational message for my team",
      mode: "expert",
    };

    const result = buildPrompt(input);

    // No template match, so intent becomes the user prompt
    expect(result.userPrompt).toBe("write a motivational message for my team");
    expect(result.metadata.templateId).toBeUndefined();
    // Should still apply mode framing
    expect(result.systemPrompt).toContain("domain expert");
  });

  it("prepends prior context when provided", () => {
    const input: BuilderInput = {
      intent: "write a follow-up",
      context: {
        data: {},
        priorContext:
          "Last call: client was interested but worried about pricing.",
      },
    };

    const result = buildPrompt(input);

    expect(result.userPrompt).toContain("Context from previous interaction");
    expect(result.userPrompt).toContain("worried about pricing");
  });

  it("adds urgency signal for urgent priority", () => {
    const input: BuilderInput = {
      intent: "respond to this complaint",
      context: {
        data: {},
        priority: "urgent",
      },
    };

    const result = buildPrompt(input);

    expect(result.userPrompt).toContain("IMPORTANT: This is urgent");
  });

  it("applies frame overrides over template and mode", () => {
    const input: BuilderInput = {
      intent: "coaching.client-checkin",
      context: { data: { clientName: "Test" } },
      overrides: {
        tone: "Extremely casual, like texting a buddy",
      },
    };

    const result = buildPrompt(input);

    // Override should win over template tone
    expect(result.systemPrompt).toContain("texting a buddy");
    expect(result.systemPrompt).not.toContain(
      "Like a text from a coach who actually remembers"
    );
  });

  it("includes all frame sections in system prompt", () => {
    const input: BuilderInput = {
      intent: "receptionist.inbound-call",
      context: {
        data: {
          businessName: "Combative Alchemy",
          businessType: "martial arts gym",
          ownerName: "JP",
          servicesList: "BJJ, Muay Thai",
          businessHours: "Mon-Fri 6am-9pm",
          availableSlots: "Tomorrow 10am",
          callerTranscript: "I want to book a class",
        },
      },
    };

    const result = buildPrompt(input);

    expect(result.systemPrompt).toContain("## Role");
    expect(result.systemPrompt).toContain("## Tone");
    expect(result.systemPrompt).toContain("## Audience");
    expect(result.systemPrompt).toContain("## Rules");
    expect(result.systemPrompt).toContain("## Output Format");
    // Context should be hydrated in the role
    expect(result.systemPrompt).toContain("Combative Alchemy");
  });

  it("returns a valid timestamp in metadata", () => {
    const result = buildPrompt({ intent: "test" });
    const parsed = new Date(result.metadata.timestamp);
    expect(parsed.getTime()).not.toBeNaN();
  });
});
