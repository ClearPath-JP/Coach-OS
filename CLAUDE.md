# ClearPath — Claude Working Instructions

## On every session start
1. Read Company/company-overview.md from Obsidian vault
2. Read Company/my-rules.md from Obsidian vault
3. Read Projects/ClearPath/brain.md from Obsidian vault
4. Read Projects/ClearPath/active-context.md from Obsidian vault
5. Confirm you have read all four files before doing anything else

## On every session end
Write a summary to Projects/ClearPath/session-log.md in Obsidian:
- What was built or changed
- Any decisions made
- What to do next

## Project location
C:\Users\jpote\Documents\ClearPath

## Coding rules
- Always use TypeScript, never plain JavaScript
- Never modify Supabase schema without asking me first
- Never touch RLS policies without confirming
- Ask before installing any new packages
- Keep changes focused and reversible — I am solo

## Never do this
- Do not touch .env files
- Do not make large architectural changes without asking
- Do not assume — if unclear, ask me

## Session end ritual
When I say "session done" or "we are done for today":
1. Write a summary to Projects/ClearPath/session-log.md
2. Update Projects/ClearPath/active-context.md 
   with what was completed and what is next
3. Note any important decisions in Company/decisions.md
Do this automatically without me having to ask for each file.

## Autonomous mode
When I say "run it" after we have agreed on a plan:
- Execute the full plan without asking for permission on each step
- Only stop and ask if you hit something unexpected or destructive
- Keep going until the plan is complete then write the session summary