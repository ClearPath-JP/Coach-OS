# Korva — Ad creatives & copy (2026-06-11)

On-brand **Dojo Arcade** image ads aimed at the core pain: *coaches who've mastered their art but give it away for free / run their dojo on a notebook + Venmo.* All rendered from `marketing/ads/ads.html` → `python marketing/ads/render-ads.py` (edit copy/colours there and re-run).

Brand voice rule (from your notes): **80% teach, 20% show — never hard-pitch.** Captions below follow that — lead with a truth, let the product be the answer.

> ⚠️ The URL on the creatives is **korvacoach.com**. If you grab a cleaner domain (getkorva.com etc.), re-render before posting.

---

## The 5 ads

| File | Size | Use | Hook |
|---|---|---|---|
| `ads/ad-1-stop-free.png` | 1080×1080 | IG / FB feed | "You mastered your art. **Stop giving it away free.**" |
| `ads/ad-2-black-belt.png` | 1080×1080 | IG / FB feed | "10 years to earn your black belt. ~~$0~~ to teach it?" (shows the product) |
| `ads/ad-3-notebook-venmo.png` | 1080×1080 | IG / FB feed | "Still running your dojo on a notebook & Venmo?" |
| `ads/ad-4-teach-world.png` | 1080×1920 | IG / FB Story / Reel cover | "Teach your art to the world. **Get paid for it.**" (community vision) |
| `ads/ad-5-founding-99.png` | 1080×1920 | IG / FB Story | "Founding coaches: **$99/mo. For life.**" (urgency, 10 spots) |

Plus `ads/og.png` (1200×630) is now wired as the site's link-share card, and `ads/icon-*.png` became the app favicon/icons.

---

## Post-ready captions

**Ad 1 — Stop teaching for free**
> You spent years earning your rank. Black belts. Bruises. 5am mornings.
> So why is your knowledge still free?
>
> The best coaches I know undercharge because billing is a hassle — chasing Venmos, juggling a notebook, no real "product" to sell.
>
> Your craft is worth paying for. Korva turns it into a real business: classes, memberships, payments, and video — one dojo, one link.
>
> → korvacoach.com
>
> #martialarts #bjj #karate #muaythai #coachlife #dojo #martialartsbusiness #jiujitsu

**Ad 2 — Black belt, $0 business**
> 10 years to earn your black belt. $0 to teach it?
>
> You don't need a website, a developer, or 5 different apps. Package your knowledge into paid programs and online courses — Korva runs the scheduling and collects the payments, so you can just coach.
>
> Real coaches. Real income. One place.
> → korvacoach.com
>
> #coaching #martialartscoach #fitnesscoach #onlinecoaching #dojolife #bjjlifestyle

**Ad 3 — Notebook & Venmo**
> Be honest — is your dojo still run on a notebook and a Venmo request? 😅
>
> Nothing wrong with starting there. But you're losing money to no-shows, forgotten payments, and "I'll pay you next week."
>
> Scheduling, memberships, payments, and video — all in one place built for solo coaches.
> → korvacoach.com
>
> #martialarts #gymowner #coachlife #smallbusiness #martialartsschool #karate

**Ad 4 — Teach your art to the world** (Story/Reel)
> A dojo without walls.
> Karate. BJJ. Muay Thai. Boxing. Judo. Every art.
>
> Korva is where coaches of every discipline run paid classes, courses, and memberships online — and build a community around what they teach.
>
> Founding spots are open. → korvacoach.com

**Ad 5 — Founding $99 for life** (Story)
> The first 10 coaches on Korva lock in $99/mo — for life.
> Everything, unlimited. Rate locked forever. A direct line to the founder.
>
> This is for the coach who's ready to run their whole practice in one place and finally charge what they're worth.
>
> Claim your spot → korvacoach.com

---

## Where to run these
- **Instagram / Facebook feed:** ads 1–3 (square).
- **Stories / Reels covers:** ads 4–5 (vertical).
- **Facebook groups** (martial-arts coach / gym-owner groups): ad 3 reads best — it's the most "one of us" and least salesy.
- **DM outreach:** attach ad 5 (founding) to the warm-coach DMs in `docs/outreach/dm-templates.md`.

## To tweak
Everything is text in `marketing/ads/ads.html` (colours = the `--yellow/--teal/--coral/--blue` belt vars). Change wording or swap a belt accent, then `python marketing/ads/render-ads.py`. Each `.frame[data-name]` re-exports to `<data-name>.png`.

> Want photographic versions (a real coach, a real dojo)? Your higgsfield account is on the free tier (**9.1 credits** — not enough for a set). Top it up and I can generate photo-real variants next session.
