import { enhancePrompt, detectCategory, detectMode } from "../builder/prompt-enhancer";

describe("detectCategory", () => {
  it("detects coaching from client/session keywords", () => {
    expect(detectCategory("write a check-in for my client")).toBe("coaching");
    expect(detectCategory("summarize this session")).toBe("coaching");
    expect(detectCategory("create a training program")).toBe("coaching");
  });

  it("detects sales from lead/follow-up keywords", () => {
    expect(detectCategory("follow up with this prospect")).toBe("sales");
    expect(detectCategory("write a proposal for this deal")).toBe("sales");
    expect(detectCategory("convert this lead")).toBe("sales");
  });

  it("detects support from help/issue keywords", () => {
    expect(detectCategory("help with this billing issue")).toBe("support");
    expect(detectCategory("respond to this complaint")).toBe("support");
  });

  it("detects analytics from data/report keywords", () => {
    expect(detectCategory("analyze this revenue data")).toBe("analytics");
    expect(detectCategory("generate a trend report")).toBe("analytics");
    expect(detectCategory("dashboard insight for growth")).toBe("analytics");
  });

  it("detects content from post/article keywords", () => {
    expect(detectCategory("write a social media post")).toBe("content");
    expect(detectCategory("draft an email newsletter")).toBe("content");
  });

  it("detects receptionist from call/booking keywords", () => {
    expect(detectCategory("handle this phone call")).toBe("receptionist");
    expect(detectCategory("respond to a booking request")).toBe("receptionist");
  });

  it("defaults to coaching when no strong signal", () => {
    expect(detectCategory("do something")).toBe("coaching");
    expect(detectCategory("hello")).toBe("coaching");
  });
});

describe("detectMode", () => {
  it("maps categories to correct default modes", () => {
    expect(detectMode("anything", "sales")).toBe("sales");
    expect(detectMode("anything", "coaching")).toBe("expert");
    expect(detectMode("anything", "support")).toBe("teacher");
    expect(detectMode("anything", "analytics")).toBe("analytical");
    expect(detectMode("anything", "content")).toBe("expert");
    expect(detectMode("anything", "receptionist")).toBe("receptionist");
  });

  it("overrides to challenger when challenge signals present", () => {
    expect(detectMode("give me honest feedback", "coaching")).toBe("challenger");
    expect(detectMode("critique this plan", "sales")).toBe("challenger");
    expect(detectMode("what's wrong with this approach", "analytics")).toBe(
      "challenger"
    );
    expect(detectMode("play devil's advocate", "content")).toBe("challenger");
    expect(detectMode("what are the risks", "coaching")).toBe("challenger");
  });

  it("falls back to expert for unknown categories", () => {
    expect(detectMode("something", "unknown")).toBe("expert");
  });
});

describe("enhancePrompt", () => {
  it("upgrades a weak coaching prompt", () => {
    const result = enhancePrompt("write a message to my client");

    // Should detect coaching category → expert mode
    expect(result.metadata.mode).toBe("expert");
    // Should have enhancement constraints
    expect(result.systemPrompt).toContain("Be specific");
    expect(result.systemPrompt).toContain("Be concise");
    expect(result.systemPrompt).toContain("next step");
    // User prompt is the raw input
    expect(result.userPrompt).toBe("write a message to my client");
  });

  it("upgrades a weak sales prompt with context", () => {
    const result = enhancePrompt("follow up with this lead", {
      leadName: "Marcus",
      interest: "personal training",
    });

    expect(result.metadata.mode).toBe("sales");
    expect(result.metadata.contextKeys).toContain("leadName");
    // Expert mode constraints should be merged with enhancement constraints
    expect(result.systemPrompt).toContain("consultative sales");
  });

  it("detects challenge intent and switches to challenger mode", () => {
    const result = enhancePrompt(
      "give me honest feedback on my coaching approach"
    );

    expect(result.metadata.mode).toBe("challenger");
    expect(result.systemPrompt).toContain("challenge assumptions");
  });

  it("returns valid assembled prompt structure", () => {
    const result = enhancePrompt("test");

    expect(result).toHaveProperty("systemPrompt");
    expect(result).toHaveProperty("userPrompt");
    expect(result).toHaveProperty("metadata");
    expect(result.metadata).toHaveProperty("mode");
    expect(result.metadata).toHaveProperty("contextKeys");
    expect(result.metadata).toHaveProperty("timestamp");
    expect(typeof result.systemPrompt).toBe("string");
    expect(typeof result.userPrompt).toBe("string");
  });
});
