# Skill System Design — ClearPath

---

## STEP 1 — RESEARCH: What Top Solo Builders Actually Use

### What matters (daily use, high leverage)

| Skill Type | Why it matters | Used when |
|---|---|---|
| **Pre-commit review** | Catches bugs, security holes, data issues before they ship | Every code change |
| **Database patterns** | Wrong query = wrong data = lost customers. Solo builders can't afford data bugs. | Every migration, every query |
| **Component patterns** | Consistent UI = ship faster. No decision fatigue on "how should this look." | Every new page/component |
| **Test runner** | Verify the flow works end-to-end before the customer hits it. | Before every deploy |
| **Deploy checklist** | Solo builders skip steps. A checklist catches what you forget at 2am. | Every deploy |

### What doesn't matter (installed but rarely used)

| Skill Type | Why it's waste | Reality |
|---|---|---|
| SEO skills | You have 0 organic traffic. SEO is a 6-month game. You need sales NOW. | Install when you have 20+ coaches |
| Design system skills | You already have a visual identity. You're not redesigning. | Install for v3 rebrand |
| Advanced architecture | You're not building microservices. You have one Next.js app. | Never needed at this scale |
| Multiple framework skills | You use Next.js. You don't need Vue, Svelte, or React Native patterns. | Noise |
| Animation/motion skills | Pretty animations don't close sales. Working features do. | Maybe post-PMF |
| Accessibility audit | Important at scale. Not what blocks your first sale. | Install at 50+ coaches |

### What top builders do differently

They don't pre-load skills. They have **3-5 core skills** they use every single day and **install others on demand** when a specific task requires it. The skill system should be a toolkit, not a library.

---

## STEP 2 — YOUR ACTUAL NEEDS

### Your daily workflow:

```
1. Open Claude Code
2. Load brain context (automatic via hooks)
3. Plan what to build (conversation)
4. Build it (code)
5. Check it works (test)
6. Deploy (vercel/git push)
7. Close session (automatic via hooks)
```

### Where skills add value:

| Step | Pain without skill | Skill needed |
|---|---|---|
| **Build** | Write bad SQL, miss edge cases | Supabase patterns |
| **Build** | Inconsistent components, re-invent UI | Component patterns |
| **Check** | Ship bugs to production | Code review |
| **Check** | "It works on my machine" | Browser testing |
| **Deploy** | Forget env vars, break webhooks | Deploy checklist |
| **Sell** | Write bad copy, miss urgency | Copy/messaging (custom) |

### What you DON'T need skills for:

- **Planning** — Claude Code Opus handles this natively. A "planner" skill just adds overhead.
- **Debugging** — Claude Code reads errors and fixes them. A "debugger" skill is redundant.
- **Refactoring** — You're building, not refactoring. Ship first.
- **Documentation** — Your Obsidian brain system handles this. Don't duplicate.

---

## STEP 3 — FINAL SKILL SYSTEM

### 8 Skills. No more.

---

### 1. `beforemerge-nextjs-review`
**Role:** Catches bugs, security holes, and anti-patterns before code ships.

**Triggered:** After writing/editing multiple files. Before committing.

**Inputs:** Changed files (TSX, TS)

**Outputs:** List of issues: CRITICAL (must fix), WARNING (should fix), NOTE (optional)

**Why it matters:** You're solo. No code review from a teammate. This IS your teammate. Catches auth bypasses, SQL injection, missing error handling, stale closures — things that break in production and you'd never notice during dev.

**Status:** KEEP (already installed)

---

### 2. `beforemerge-nextjs-supabase-standards`
**Role:** Catches data layer bugs specific to Next.js + Supabase.

**Triggered:** After editing API routes, server components, or database queries.

**Inputs:** Changed files touching Supabase (routes, server actions, lib/)

**Outputs:** Issues with: RLS policies, missing error handling on queries, server vs client Supabase client usage, auth patterns

**Why it matters:** Your entire product runs on Supabase. One bad query, one missing RLS check, one wrong client usage = data leak or crash. This catches Supabase-specific mistakes that the general review skill misses.

**Status:** KEEP (already installed)

---

### 3. `supabase`
**Role:** Reference for Supabase patterns — Auth, Edge Functions, Realtime, Storage, RLS, client libraries.

**Triggered:** When working with any Supabase feature. Automatically activates on supabase-related code.

**Inputs:** Current task context (what you're building)

**Outputs:** Correct patterns, API usage, configuration guidance

**Why it matters:** Supabase moves fast. Your training data may be stale. This skill has current docs for auth flows, RLS patterns, and SSR integration. Prevents you from using deprecated APIs.

**Status:** KEEP (already installed)

---

### 4. `supabase-postgres-best-practices`
**Role:** Postgres query optimization and schema design patterns.

**Triggered:** When writing migrations, complex queries, or debugging slow pages.

**Inputs:** SQL or Supabase query code

**Outputs:** Optimized queries, index recommendations, schema advice

**Why it matters:** Bad queries don't hurt with 5 users. They kill your app with 50. This skill bakes in good habits now so you don't have to rewrite everything later. Covers: proper indexing, avoiding N+1 queries, connection pooling, row-level security patterns.

**Status:** KEEP (already installed)

---

### 5. `tailwindcss`
**Role:** Tailwind CSS v4 patterns — responsive design, dark mode, configuration.

**Triggered:** When styling components. Automatic on TSX files with className.

**Inputs:** Component JSX

**Outputs:** Correct Tailwind utility classes, responsive patterns, theme configuration

**Why it matters:** You style everything with Tailwind. Getting the v4 syntax right (especially @theme, @custom-variant, and the new config format) saves debugging time on every component. Also prevents you from writing custom CSS when a utility class exists.

**Status:** KEEP (already installed)

---

### 6. `nextjs-shadcn`
**Role:** Next.js + shadcn/ui component patterns and project structure.

**Triggered:** When building pages, components, or working with shadcn UI primitives.

**Inputs:** Feature requirements

**Outputs:** Correct component composition, import patterns, theming integration

**Why it matters:** shadcn is your component foundation. This skill knows the correct composition patterns (compound components, slots, variants), prevents import mistakes, and guides you to use existing primitives instead of reinventing them.

**Status:** KEEP (already installed). Note: merge `shadcn` into this — they overlap. Keep one.

---

### 7. `webapp-testing`
**Role:** Browser-based testing via Playwright. Verify flows work end-to-end.

**Triggered:** Before deploying. When testing user flows (signup → onboard → use).

**Inputs:** URL + flow description ("test the coach login flow")

**Outputs:** Screenshots, pass/fail, browser console logs

**Why it matters:** You can't manually test every flow before every deploy. Playwright clicks through the real app, fills forms, verifies pages load. This is how you catch "it looks fine in code but is broken in the browser" bugs. Critical for a solo builder with no QA team.

**Status:** KEEP (already installed)

---

### 8. `ship-check` (NEW — custom, build this)
**Role:** Pre-deploy checklist. Runs automatically before pushing to production.

**Triggered:** When you say "deploy", "ship", "push to prod", or run `vercel --prod`.

**Inputs:** Current git diff, environment context

**Outputs:** Checklist with pass/fail:
- TypeScript compiles (`tsc --noEmit`)
- No `console.log` in production code
- No hardcoded localhost URLs
- No `.env` values committed
- All new API routes have auth checks
- Stripe webhook URL matches production domain
- Database migrations are committed

**Why it matters:** You deploy solo. No staging environment. No QA. This is your safety net — a 30-second automated check that catches the dumb mistakes that take down production. The ones you'll make at 2am when you're tired and think "it's fine, just push it."

**Status:** BUILD THIS (see structure below)

---

### What to remove

**Remove `shadcn`** — overlaps with `nextjs-shadcn`. Same coverage, redundant context.

**Final count: 8 skills** (7 existing + 1 custom)

---

## STEP 4 — SKILLS THAT ARE USELESS FOR YOU

### Don't install these (common traps):

| Skill type | Why it's waste for YOU |
|---|---|
| **SEO skills** (13 existed) | 0 organic traffic. SEO is a marathon. You need a sprint to first revenue. |
| **Design/UX skills** (animate, polish, critique, layout, etc.) | Your UI is built. Making it prettier doesn't close sales. |
| **iOS/mobile skills** | You're building a web app. PWA later, native never (at this stage). |
| **Advanced engineering** (architecture, patterns, multi-agent) | Over-engineering for one product with one customer. |
| **Content generation** (blog outline, newsletter, social post) | You should write content yourself — it's your voice, your teaching. AI-generated content feels generic to coaches. |
| **Performance optimization** | You have 0 concurrent users. Performance is not your bottleneck. |
| **Skill creators / meta-skills** | Don't build skills to build skills. Build skills to ship product. |
| **Brand/visual identity** | You have Combative Alchemy's visual identity. It's done. Move on. |

### The rule:

**If a skill doesn't help you ship code or close a sale THIS WEEK, don't install it.**

---

## STEP 5 — FOLDER STRUCTURE

```
COACH-OS/
├── .agents/
│   └── skills/
│       ├── beforemerge-nextjs-review/       ← code review (pre-installed)
│       │   ├── SKILL.md
│       │   └── rules/                       ← review rules by category
│       ├── beforemerge-nextjs-supabase-standards/  ← supabase review (pre-installed)
│       │   └── SKILL.md
│       ├── supabase/                        ← supabase patterns (pre-installed)
│       │   └── SKILL.md
│       ├── supabase-postgres-best-practices/ ← postgres patterns (pre-installed)
│       │   └── SKILL.md
│       ├── tailwindcss/                     ← tailwind v4 patterns (pre-installed)
│       │   └── SKILL.md
│       ├── nextjs-shadcn/                   ← component patterns (pre-installed)
│       │   └── SKILL.md
│       ├── webapp-testing/                  ← playwright testing (pre-installed)
│       │   └── SKILL.md
│       └── ship-check/                      ← pre-deploy checklist (BUILD THIS)
│           └── SKILL.md
│
├── .claude/
│   ├── agents/
│   │   ├── n8n-builder.md                   ← build n8n workflows (Haiku)
│   │   └── n8n-debugger.md                  ← fix n8n workflows (Haiku)
│   └── settings.local.json                  ← project permissions
```

### Naming conventions:

| Pattern | Use |
|---|---|
| `beforemerge-*` | Skills that run BEFORE code is committed. Review/lint/check skills. |
| `*-patterns` or `*-best-practices` | Reference skills that provide correct patterns. Passive — activated by context. |
| Verb-based (`ship-check`, `webapp-testing`) | Action skills that DO something. Triggered explicitly or by hooks. |

### How to write SKILL.md:

```yaml
---
name: skill-name
description: One sentence — WHEN to trigger this skill. Be specific.
version: 1.0.0
user-invocable: true          # can user call /skill-name directly?
allowed-tools: Read Grep Bash  # what tools the skill needs
---

# What this skill does (2-3 sentences max)

## When to use
- Bullet list of triggers

## Rules
- Bullet list of what the skill checks/does

## Examples (optional)
- Before/after or input/output examples
```

### How to keep skills clean:

1. **One skill, one job.** If a skill does two things, split it or pick one.
2. **Description is the trigger.** Claude matches skills by description. Write it like a search query: "Use when X happens" not "This skill provides comprehensive..."
3. **No overlapping skills.** If two skills cover the same territory, delete one.
4. **Version your changes.** Bump version when you modify a skill so you know which version is active.
5. **Delete before adding.** Before installing a new skill, ask: does an existing skill already cover this?

---

## STEP 6 — HOW SKILLS WORK TOGETHER

### The chain that matters:

```
BUILD  →  REVIEW  →  TEST  →  SHIP
  │          │         │        │
  ▼          ▼         ▼        ▼
supabase   beforemerge  webapp   ship-check
tailwind   nextjs-review testing
shadcn     supabase-standards
```

### How this flows in practice:

**Phase 1: BUILD** (you're writing code)
- `supabase` activates when you write queries or migrations
- `tailwindcss` activates when you style components
- `nextjs-shadcn` activates when you compose UI
- `supabase-postgres-best-practices` activates on complex queries
- These are **passive** — they inform Claude's code generation. You don't invoke them.

**Phase 2: REVIEW** (you're done building)
- You invoke `/beforemerge-nextjs-review` or it triggers after significant edits
- Scans for: security holes, performance issues, React anti-patterns
- Then `/beforemerge-nextjs-supabase-standards` runs
- Scans for: RLS gaps, wrong client usage, missing error handling
- **Fix everything flagged as CRITICAL before continuing.**

**Phase 3: TEST** (you verify it works)
- You invoke `/webapp-testing` or say "test the coach login flow"
- Playwright opens the app, runs through the flow
- Returns screenshots + pass/fail + any console errors
- **If tests fail, go back to BUILD. Don't skip to SHIP.**

**Phase 4: SHIP** (you deploy)
- You say "deploy" or "ship it"
- `ship-check` runs automatically (or you invoke `/ship-check`)
- Runs the pre-deploy checklist
- If everything passes: deploy
- If something fails: fix it first

### The key insight:

Skills don't need complex orchestration. They work in a **natural sequence** that matches how you already work:

1. You build → pattern skills guide the code
2. You finish → review skills check the code
3. You test → testing skill verifies the app
4. You deploy → ship-check guards the gate

No skill framework needed. No chaining config. Just 8 skills doing their jobs at the right moment.

---

## SUMMARY

| What | Count | Names |
|---|---|---|
| **Pattern skills** (passive, guide code) | 4 | supabase, supabase-postgres, tailwindcss, nextjs-shadcn |
| **Review skills** (active, check code) | 2 | beforemerge-nextjs-review, beforemerge-nextjs-supabase-standards |
| **Action skills** (active, do things) | 2 | webapp-testing, ship-check |
| **Agents** (separate processes, Haiku) | 2 | n8n-builder, n8n-debugger |
| **Total** | **10** | 8 skills + 2 agents |

This is your entire AI tooling layer. It covers build, review, test, ship, and automation. Nothing else is needed until you have paying customers asking for features that require new capabilities.
