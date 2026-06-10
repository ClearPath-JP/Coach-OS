# ☀️ Good morning — your 6 Korva design directions are ready

You asked to wake up to multiple paths the app could go. Here they are — six genuinely distinct art directions, each covering your **landing page + coach side + client portal**, in **desktop and mobile**. Same product, same content, six different souls. Pick whatever resonates and we build it for real → deploy → DM your first coach.

## How to look
**Open `design-explorations/index.html` in your browser** — it's a gallery of all 6 directions, every screen, desktop + mobile, click any frame to enlarge. (Each shot is a live HTML render, not a Figma mock — so the one you pick is already 70% built.)

- **60 screenshots** across 6 directions × 5 screens × 2 viewports.
- **"Korva" name kept** everywhere, as you asked.
- **Nothing touched in production** — this all lives in `design-explorations/` on a separate branch (`design/overnight-explorations`). Your `rebuild/v2` and prod are exactly where you left them.

---

## The six directions

Each is grounded in the references *you* dropped in `INSPO/` — I didn't guess, I built from your taste.

### 01 · Dojo Nightfall  — *your brand, leveled up*
Warm near-black + polished brass `#c8882e`, Shippori Mincho headlines, glossy cards, surgical accent. This is the **safe evolution** of what you already have — keeps your brand equity, just makes it feel expensive.
**Strength:** on-brand, premium, nobody else in coaching looks like this. **Watch-out:** it's familiar (to you).
**Grounded in:** your existing brass research doc.

### 02 · Aurora Dark — *the "wow" demo*
Premium animated dark SaaS: gradient headline, subtle perspective glow, amber for money + an indigo→violet→rose aurora for identity, spinning-ring CTAs. Feels like a 2026 v0/Linear-grade product.
**Strength:** highest "is this really for solo coaches?!" wow factor; modern and confident. **Watch-out:** trendier, so it dates faster than 01.
**Grounded in:** your `hero-section-dark` + `pricing-section` INSPO.

### 03 · Daylight Studio — *calm & approachable*
Soft light mode — warm cream, lavender washes, rounded friendly cards, Fraunces serif. The least intimidating option; feels welcoming rather than "software."
**Strength:** approachable, great if your coaches aren't tech-y; stands out (everyone else is dark). **Watch-out:** less "premium tool," more "friendly app."
**Grounded in:** your `sensei inspo` LMS shot + `pricing-interaction`.

### 04 · Mono Tatami — *the precision instrument*
Near-monochrome Linear/Vercel restraint — hairlines, dense data tables, one near-white accent, command-bar + filter chips. Reads as "made by people who care."
**Strength:** timeless, fast, pro; the coach data (clients, balances, status) shines. **Watch-out:** the *least* differentiated (looks like dev tools) and coolest in tone — your warmth/brand signal is gone.
**Grounded in:** your `filters` + `spotlight-table` INSPO.

### 05 · Dojo Arcade — *Duolingo for coaching*
Bold gamified neo-brutalist — thick borders, hard shadows, belt-bright colors, and the client side is **streaks + XP + belt journey + medals**. The student portal is genuinely addictive.
**Strength:** unmatched **student engagement & retention** — students *want* to open it; huge word-of-mouth potential. **Watch-out:** the boldest swing; may read as "playful" to a premium coach buyer. Consider it especially for the **client portal**.
**Grounded in:** your `mobile sensei app` shot.

### 06 · Glass Sanctuary — *ethereal premium*
Glassmorphism over an aurora gradient — frosted panels, elegant Instrument Serif headlines, violet glow, lots of air. The most "high-end / aspirational."
**Strength:** beautiful, distinctive, feels luxury. **Watch-out:** glass + lots of motion is the hardest to keep legible/consistent as the app grows; needs discipline.
**Grounded in:** your `sign-in` glass INSPO.

---

## My honest recommendation

There are really two jobs here, and they might want different answers:

1. **Selling to a coach (landing + first impression):** **02 Aurora Dark** or **01 Dojo Nightfall.** Aurora has the bigger wow; Dojo keeps your hard-won brand. If you want to *turn heads on Instagram*, Aurora. If you want *"this is unmistakably Korva,"* Dojo.
2. **Keeping the coach's students hooked (client portal):** **05 Dojo Arcade.** Gamified streaks/belts/medals drive the retention that makes coaches *stay subscribed*. That's your churn killer.

**My pick if I had to choose one:** **02 Aurora Dark for the coach-facing app + landing, with 05's gamification grafted into the client portal.** Best of both — a premium tool you're proud to demo, and a student experience that sells itself. **01 Dojo Nightfall** is the no-regret fallback if you'd rather evolve the current brand than switch.

(But this is your call — that's the whole point of seeing them side by side.)

---

## One thing worth knowing (transparency)
Aurora's hero fought me for a while: an animated spinning-ring CTA was missing an `overflow:hidden`, so a bright gradient ring bloomed across the page and buried the headline. Found and fixed (one line) — it's clean now. Everything in the gallery is the *fixed* state. The screenshot harness (`design-explorations/shot.mjs`) inlines CSS to render reliably; re-run `node design-explorations/shot.mjs [dir]` anytime.

Recordings (scroll-through videos) — I left these out to keep it focused, but I can add them per direction in ~10 min if you want them.

---

## When you're ready
Tell me the direction (or the hybrid). Then I'll: write a proper spec → rebuild the real app surfaces in that language on `rebuild/v2` → verify → deploy → and you DM your founding coach the link with "let's start." 🚀

To get back to product work: `git checkout rebuild/v2` (this exploration stays safe on its own branch).
