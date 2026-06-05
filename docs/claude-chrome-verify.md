# Claude Chrome — verify the video-playback fix

Two phases. Phase 1 (Bunny dashboard) is valid anytime. **Phase 2 (the app) only passes
after the `rebuild/v2` fix is deployed** — on old/undeployed code the video is still gray.

```
You're verifying a video-playback fix for my coaching app (Kindo / coach.foundos.ai) by
driving Chrome. Two phases. Read-only on all settings — change NOTHING. Report a clear
PASS/FAIL per checkpoint with a screenshot.

PHASE 1 — Bunny dashboard (https://dash.bunny.net)
1. Confirm I'm logged in; if not, pause and tell me.
2. Open Stream → my video library (the one for Kindo / coach.foundos.ai). If there are
   several, list them (name + Library ID) and ask me which.
3. Encoding settings: report whether "MP4 Fallback" is ON or OFF. Do not change it.
4. Security settings — report each ON/OFF, change nothing:
   - Block Direct URL File Access (URL token authentication)
   - Embed View Token Authentication
   - Allowed Referrers (list domains; note whether coach.foundos.ai is present)
5. Report the Library ID and the CDN hostname.

PHASE 2 — The app (only meaningful AFTER the fix is deployed)
Target: https://coach.foundos.ai (or whatever URL I give you). Use my existing logged-in
session; if I'm not signed in, pause and ask me — do NOT enter credentials.
1. Go to the coach Video library.
2. Find the clip "DSCF1900" (or my most recent upload).
3. CHECKPOINT A (thumbnail): does the card show a real thumbnail image, not a gray/black box?
4. Hover the card: does a short muted preview clip play? (needs MP4 Fallback ON)
5. Click the video to open the player. CHECKPOINT B (playback): does the video actually PLAY
   with a moving picture and controls — NOT a gray box? Let it run ~3s and screenshot it playing.
6. Open DevTools console and report any red errors mentioning: CSP, "Refused to load",
   b-cdn.net, mediadelivery, or media.

REPORT
- Phase 1: MP4 Fallback ON/OFF; the 3 security settings; Library ID + CDN host.
- Phase 2: PASS/FAIL for Checkpoint A, hover-preview, Checkpoint B; any console errors; screenshots.
- Anything surprising.

GUARDRAILS: change no Bunny settings, reveal no secret API keys, enter no passwords.
If anything looks risky or ambiguous, stop and ask me.
```

## What I need from the report
- **Phase 1 → "Embed View Token Authentication"** is the one gated item. If it's **ON**, the
  iframe embed must be signed (code is structured for it). If OFF, we're done as-is.
- **Phase 2** confirms the fix end-to-end. Checkpoint B = the gray-screen bug is gone;
  Checkpoint A + hover = the previews/posters render (CSP fix working).
