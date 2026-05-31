# Vercel prod env vars — video editor (Bunny + Remotion/Lambda)

Add these to the Vercel project **sensei-app** (prod = coach.foundos.ai) so the
Promote → Video render works on deployed builds. Set for **Production AND Preview**
(Preview lets the `rebuild/v2` branch deployments render too).

Dashboard: vercel.com → project **sensei-app** → **Settings → Environment Variables**.

## Values

| Name | Value | Notes |
|---|---|---|
| `BUNNY_STREAM_LIBRARY_ID` | `672196` | public |
| `BUNNY_STREAM_CDN_HOST` | `vz-328fcdea-402.b-cdn.net` | public |
| `BUNNY_STREAM_API_KEY` | *(copy from local `.env.local`)* | SECRET |
| `BUNNY_STREAM_TOKEN_KEY` | *(copy from local `.env.local` — Bunny URL token key)* | SECRET |
| `REMOTION_APP_REGION` | `us-east-1` | public |
| `REMOTION_APP_FUNCTION_NAME` | `remotion-render-4-0-468-mem2048mb-disk2048mb-120sec` | public |
| `REMOTION_APP_SERVE_URL` | `https://remotionlambda-useast1-rczpiznaa1.s3.us-east-1.amazonaws.com/sites/kindo-captioned/index.html` | public |
| `REMOTION_AWS_ACCESS_KEY_ID` | *(copy from local `.env.local`, starts `AKIA…`)* | SECRET |
| `REMOTION_AWS_SECRET_ACCESS_KEY` | *(copy from local `.env.local`)* | SECRET |

The 6 public values above match `.env.local` exactly (verified). Secrets are never
written here — copy them from `.env.local`. The Vercel env page accepts bulk paste of
`KEY=value` lines, so you can paste the matching block straight from `.env.local`.

## Also still pending for prod (from prior sessions)
- Stripe tier prices → 79/149/299
- add `APIFY_TOKEN`
- **rotate `ANTHROPIC_API_KEY`** (was exposed)

## After setting
A redeploy picks them up. Needed before merging `rebuild/v2` → main; setting them now
also makes `rebuild/v2` PREVIEW deployments render-capable.
