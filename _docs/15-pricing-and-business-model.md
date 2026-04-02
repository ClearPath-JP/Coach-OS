# ClearPath — Pricing and business model

**Last updated:** 2026-04-02

## Value proposition

ClearPath replaces a patchwork of scheduling tools, course platforms, spreadsheets, and disconnected Stripe activity with **one branded workspace**: clients book sessions, message their coach, follow programs and assignments, pay invoices (including via Stripe Connect), and stay engaged through goals, check-ins, and lightweight gamification—while the coach runs the practice from a single dashboard with analytics and admin-grade controls when you operate as a platform.

## Target customer

Solo coaches and small coaching practices with roughly **1–30 active clients** who want **one professional, branded system** instead of juggling many separate tools.

## Tools replaced

| Tool | Typical cost (illustrative) | ClearPath equivalent |
|------|----------------------------|----------------------|
| Practice Better | ~$89/mo | Client management, sessions, notes |
| Calendly | ~$16/mo | Calendar, availability, booking |
| Kajabi / course platforms | ~$150/mo+ | Programs, content, video library |
| Manual tracking | 5–10 hrs/week | Dashboards, assignments, goals, analytics |
| Stripe dashboard alone | Free but fragmented | Invoices, Connect checkout, revenue views |

*Competitor pricing varies by plan and region; use for positioning only.*

## Pricing tiers

### Free tier

- Up to **3** clients
- Basic messaging
- **1** program
- Manual payments only
- ClearPath branding visible

### Starter — $49/month

- **10** clients
- Everything in Free
- Custom workspace display name
- Basic analytics
- Email support

### Pro — $79/month

- **30** clients
- Everything in Starter
- White-label branding
- Google Drive video library and streaming
- Programs and assignments
- XP and rewards
- Goal tracking and testimonials
- Re-engagement and automation hooks (check-ins, broadcasts)

### Scale — $129/month

- **Unlimited** clients (fair use / platform limits still apply technically)
- Everything in Pro
- Group coaching *(planned)*
- Session notes with AI *(planned)*
- Package bundles & installments *(planned)*
- Public coach profile *(planned)*
- Priority support

*Tiers are a **product positioning** model; map to your real Stripe Price IDs in `.env` and Vercel.*

## Setup fee model (done-for-you)

Many buyers pay for **migration and configuration** plus ongoing hosting:

| Tier | Example | Includes |
|------|---------|----------|
| First coach / pilot | **$297** setup + **$59**/mo | Single workspace, branding, imports, training call |
| Standard | **$497** setup + **$99**/mo | Above + programs, Drive, assignments go-live |
| Premium | **$797** setup + **$149**/mo | Above + custom copy, priority onboarding, deeper integrations |

Adjust numbers for your market; the codebase supports per-deployment billing via Stripe.

## V3 roadmap (high level)

- Resource library and progress journal
- Bundles, installments, group sessions
- Public coach page and habit tracker
- Progress photos and monthly PDF report
- Mobile app (React Native)
- Zapier webhooks and AI note summaries
- Waiting list automation

See also [_docs/13-v2-roadmap.md](./13-v2-roadmap.md) for engineering-facing notes.
