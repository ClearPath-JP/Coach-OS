import { NextRequest, NextResponse } from "next/server";
import { buildPrompt, enhancePrompt } from "@/lib/prompt-engine";
import type { BuilderInput, FramingMode } from "@/lib/prompt-engine";
import { checkRateLimitAsync } from "@/lib/rate-limit";

/**
 * POST /api/prompt-engine/build
 *
 * Accepts a prompt intent + context and returns a structured,
 * high-performance prompt ready to send to an LLM.
 *
 * Body:
 *   { intent: string, context?: { data: Record<string, unknown>, priorContext?: string }, mode?: FramingMode }
 *
 * If intent matches a template ID (e.g. "coaching.client-checkin"),
 * the template is used. Otherwise, the enhancer auto-detects category
 * and mode from the raw prompt text.
 */
export async function POST(req: NextRequest) {
  // Intentionally public (pure deterministic templating — no DB, no secrets), so
  // rate-limit by IP to prevent compute abuse. Fail-open if Redis is unset.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const { success, retryAfter } = await checkRateLimitAsync(`prompt-engine:${ip}`, {
    windowMs: 60_000,
    max: 30,
  });
  if (!success) {
    const res = NextResponse.json({ error: "Too many requests — slow down a moment." }, { status: 429 });
    if (retryAfter) res.headers.set("Retry-After", String(retryAfter));
    return res;
  }

  try {
    const body = await req.json();

    if (!body.intent || typeof body.intent !== "string") {
      return NextResponse.json(
        { error: "Missing required field: intent (string)" },
        { status: 400 }
      );
    }

    const input: BuilderInput = {
      intent: body.intent,
      context: body.context,
      mode: body.mode as FramingMode | undefined,
      overrides: body.overrides,
    };

    // If intent looks like a template ID (has a dot), use buildPrompt directly.
    // Otherwise, use the enhancer which auto-detects category and mode.
    const isTemplateId = body.intent.includes(".");
    const result = isTemplateId
      ? buildPrompt(input)
      : enhancePrompt(body.intent, body.context?.data);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[POST /api/prompt-engine/build]", error);
    return NextResponse.json(
      { error: "Failed to build prompt" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/prompt-engine/build
 *
 * Returns available template IDs and mode names for discovery.
 */
export async function GET() {
  const { getTemplateIds } = await import("@/lib/prompt-engine");
  const { getModeNames } = await import("@/lib/prompt-engine");

  return NextResponse.json({
    templates: getTemplateIds(),
    modes: getModeNames(),
  });
}
