# ClearPath documentation index

**Last updated:** 2026-04-02

Use this file to find the right doc quickly. Paths are relative to `_docs/` unless noted.

## Technical docs

| Doc | Description |
|-----|-------------|
| [00-index.md](./00-index.md) | This index — navigation for all documentation. |
| [01-architecture.md](./01-architecture.md) | High-level app architecture, folders, and data flow. |
| [02-database-schema.md](./02-database-schema.md) | Tables, columns, RLS patterns, storage buckets, known gaps. |
| [03-env-variables.md](./03-env-variables.md) | Environment variables and where they are used. |
| [04-client-management.md](./04-client-management.md) | Client records, invite flow, portal access patterns. |
| [05-messaging.md](./05-messaging.md) | Realtime messaging, threads, read state. |
| [06-calendar-scheduling.md](./06-calendar-scheduling.md) | Availability, sessions, booking, calendar feeds. |
| [07-video-pipeline.md](./07-video-pipeline.md) | Videos, Drive import, streaming, optional n8n/CloudConvert. |
| [08-program-builder.md](./08-program-builder.md) | Programs, modules, content, client progress. |
| [09-api-routes.md](./09-api-routes.md) | API route reference (methods, auth, bodies, responses). |
| [10-components.md](./10-components.md) | UI component registry and conventions. |
| [11-auth-permissions.md](./11-auth-permissions.md) | Roles, RLS, coach/client/admin access. |
| [12-user-flows.md](./12-user-flows.md) | Primary user journeys through the product. |
| [13-v2-roadmap.md](./13-v2-roadmap.md) | Roadmap and feature tracking for V2/V3. |
| [14-cursor-rules.md](./14-cursor-rules.md) | Cursor / AI editing conventions (companion to root `.cursorrules`). |
| [15-pricing-and-business-model.md](./15-pricing-and-business-model.md) | Positioning, tiers, setup fees, tools replaced. |

## Design docs (`../_design/`)

| Doc | Description |
|-----|-------------|
| D1 — Brand identity | Logo, color intent, voice. |
| D2 — Design system | Layout grids and tokens. |
| D3 — Component styles | Buttons, forms, cards. |
| D4 — Dark mode | Theme switching behavior. |
| D5 — Mobile design | Breakpoints and portal priorities. |

*Exact filenames under `_design/` may vary; open the folder for current list.*

## Audit / review docs

| Doc | Description |
|-----|-------------|
| [A6-v2-complete-review.md](./A6-v2-complete-review.md) | **Canonical V2 build summary** — stats, phases, limitations, V3 ideas. |

## Security docs (`../_security/`)

| Doc | Description |
|-----|-------------|
| S1 — Security audit | Threat model and hardening notes. |
| S2 — Rate limiting | Upstash and per-route limits. |
| S3 — *(if present)* | Additional security reviews. |

## Flow docs

| Doc | Description |
|-----|-------------|
| [12-user-flows.md](./12-user-flows.md) | Primary coach and client flows (see also coach/client sections in feature docs). |

## Deployment & operations (repo root)

| Doc | Description |
|-----|-------------|
| [../README.md](../README.md) | Quick start, scripts, structure. |
| [../DEPLOYMENT.md](../DEPLOYMENT.md) | Supabase, Stripe, Vercel, env vars, migrations. |
| [../CHECKLIST.md](../CHECKLIST.md) | Pre-launch verification. |
| [DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md) | Vercel-specific notes if present. |

## Integrations & skills

| Doc | Description |
|-----|-------------|
| [GOOGLE-DRIVE-SETUP.md](./GOOGLE-DRIVE-SETUP.md) | Google Cloud OAuth for Drive. |
| [N8N-VIDEO-DECISION.md](./N8N-VIDEO-DECISION.md) | When n8n is optional vs required. |
| [site-pages.md](./site-pages.md) | Site map / route inventory helper. |
| [skills/](./skills/) | Theming, n8n, and other skill-style guides. |
| [T2-billing-subscriptions.md](./T2-billing-subscriptions.md) | Stripe billing deep dive. |

## Cursor rules

| Doc | Description |
|-----|-------------|
| [../.cursorrules](../.cursorrules) | **Authoritative** project rules for AI and humans. |
| [14-cursor-rules.md](./14-cursor-rules.md) | Archived or expanded Cursor guidance. |

---

**Mandatory session start (from `.cursorrules`):** read `01-architecture.md`, `02-database-schema.md`, and `13-v2-roadmap.md` before large feature work.
