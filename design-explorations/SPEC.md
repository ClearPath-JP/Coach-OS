# Korva — Overnight Design Explorations (SPEC)

**Goal:** 6 boldly distinct art directions for the Korva coaching platform, each rendered as standalone HTML mockups → screenshots (desktop + mobile). Built so the founder can pick a direction to actually build. Same content in every direction; only the visual language changes.

**Hard rules**
- Keep the **Korva** name everywhere (the platform brand). Never rename it.
- Every direction renders the **same 5 screens** with the **same canonical content** below — only the visual design differs, so they're directly comparable.
- Self-contained HTML files. Tailwind via Play CDN (`https://cdn.tailwindcss.com`) + Google Fonts + a per-direction `<style>` block. No build step, no backend.
- Realistic, populated UI (never empty states). Use the canonical content verbatim.
- Each screen is its own `.html` file. The screenshot harness renders each at 1440×900 (desktop) and 390×844 (mobile), full-page.

---

## CANONICAL CONTENT (use verbatim across ALL directions)

**Platform brand:** Korva — "The operating system for solo coaches."
- Founding offer: **$99/mo for life** (first 10 founding coaches). Public tiers after: **Starter $79 · Pro $149 · Scale $299**.
- Wordmark: "Korva" (style it per-direction; the original brand renders it as KOR + accent VA, but each direction may interpret).

**The coach (app is white-labeled to him):** Coach **Marcus Vale** — "Vale Method", a solo BJJ + striking coach running private + small-group classes. Avatar = initials "MV".

**Students / clients (24 active):** Diego Santos (blue belt), Sarah Chen (white belt), Tom Becker (purple belt), Aisha Khan (white belt), Marcus Lee (blue belt), Priya Patel (white belt).

**Classes:**
- Fundamentals — Mon/Wed 6:00pm · cap 12 · 8 booked · $25 drop-in
- Sparring — Tue/Thu 7:00pm · cap 10 · 6 booked · members only
- Open Mat — Sat 10:00am · cap 16 · 11 booked · free for members
- Private 1:1 — by appointment · $80

**Today's schedule (coach):** 9:00am Diego Santos (Private) · 11:00am Sarah Chen (Private) · 6:00pm Fundamentals (group, 8 booked).

**Coach dashboard stats:** Active students **24** · This week **$1,840** · Unread messages **3** · Classes this week **6**.

**Recent activity:** "Invoice paid — $240 from Diego" · "New student joined — Aisha Khan" · "Sarah booked Sparring (Thu)".

**Coach nav (sidebar):** Dashboard · Schedule · Clients · Classes · Messages · Payments · Settings. (Plus a ⌘K search.)

**Landing testimonials (coaches praising Korva):**
- "Korva replaced 5 apps. I run my whole gym from my phone now." — Elena R., kickboxing coach
- "Booking + payments in one tap. My students actually show up." — Dré M., BJJ coach
- "Set it up in an afternoon. Looks like I hired a designer." — Sam T., strength coach

**Landing features (pick icons per direction):** Scheduling & classes · Payments & passes (Stripe) · Client progress & belts · Messaging · Video library · Promote (AI content).

**Client portal (student = Diego's view of "Vale Method on Korva"):**
- Greeting: "Welcome back, Diego"
- Next class: Fundamentals — today 6:00pm (booked)
- My passes: **3 class credits left**
- My progress: Blue belt · 60% to next stripe
- Quick links: Book a class · Message coach · My videos · Invoices
- Upcoming: Fundamentals (today 6pm), Open Mat (Sat 10am)

**Client classes/booking screen:** the 4 classes above as bookable cards with coverage labels:
- Fundamentals → "Covered by your pass · 3 left" (primary action: Book)
- Sparring → "Members only" badge
- Open Mat → "Free for members"
- Private 1:1 → "$80 · Request"
- Passes balance shown: "3 class credits".

---

## THE 5 SCREENS (every direction builds all 5)

1. **landing.html** — Korva marketing page (full scroll): sticky top nav (wordmark + links + "Sign in" + primary CTA "Start free"), hero (headline + subhead + CTA + an in-page app-preview mock), 3 testimonial cards, feature grid (6), pricing ($99 founding highlighted + 3 tiers), footer.
2. **coach-dashboard.html** — App shell: left sidebar (wordmark + nav groups + coach account), top bar (⌘K search + avatar). Main: greeting "Good morning, Marcus", 3 stat cards, **Today's schedule** panel, **Recent activity** panel, quick-action buttons.
3. **coach-schedule.html** — App shell + main: a **week calendar grid** (Mon–Sun, time rows) with the classes/sessions placed, today's column highlighted, plus a side panel listing the 4 classes (or a selected-class roster).
4. **client-portal.html** — Client shell (lighter nav, themed "Vale Method · powered by Korva"): greeting, **Next class** card, **My passes** (3 credits), **progress** (blue belt 60%), quick links, upcoming list.
5. **client-classes.html** — Client booking: the 4 classes as cards with coverage labels + Book actions, passes balance, a clean header.

**File + shot naming:** `design-explorations/<NN-slug>/<screen>.html` → harness writes `…/<NN-slug>/shots/<screen>-desktop.png` and `…-mobile.png`.

---

## THE 6 DIRECTIONS (summary — full brief per direction given at build time)

1. **01 · Dojo Nightfall** — the current brand, *elevated*. Warm near-black `#141210`, polished brass `#c8882e`, Shippori Mincho + Instrument Sans. Glossy material: noise grain, specular top-edge highlights, glass modals, brass restricted to active nav / primary CTA / focus. Mood: a dojo at night. (Refs: design-references.md Direction A.)
2. **02 · Aurora Dark** — premium animated dark SaaS. Near-black, a perspective **retro-grid** hero, radial **glow**, **gradient text**, conic-gradient border CTAs, big animated numbers. Accent: brass→amber meets indigo/violet aurora. Mood: techy, v0-grade, alive. (Refs: hero-section-dark, pricing-section.)
3. **03 · Daylight Studio** — soft **light** mode. Cream/`#f6f2ec` + lavender, rounded-[28px] friendly cards, generous air, black or violet accent, animated pill toggles. Mood: calm, approachable, premium-light LMS. (Refs: sensei inspo, pricing-interaction.)
4. **04 · Mono Tatami** — near-monochrome **Linear/Vercel precision**. `#0a0a0a` + hairline borders `rgba(255,255,255,.08)`, one near-white accent, dense data, command-palette + filter chips, tabular numbers. Mood: pro instrument, restraint. (Refs: filters, spotlight-table, design-references Direction B.)
5. **05 · Dojo Arcade** — bold **gamified neo-brutalist**. Thick black borders, hard offset shadows, belt-bright blocks (yellow/teal/violet/red), XP/streaks/medals, chunky rounded. Mood: fun, sticky, Duolingo-for-coaching. (Refs: mobile sensei app.)
6. **06 · Glass Sanctuary** — **glassmorphism** + editorial. Frosted backdrop-blur panels over a soft aurora gradient, violet focus, large light type, lots of space. Mood: ethereal, modern, premium. (Refs: sign-in glass inputs/testimonials, design-references Direction C.)
