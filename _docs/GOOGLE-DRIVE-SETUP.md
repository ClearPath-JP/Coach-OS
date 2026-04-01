# Google Drive Setup for ClearPath

## How it works

Each coach connects **their own** Google account. ClearPath uses OAuth to get permission to read their Drive files.

The coach goes to:

**Settings → Integrations → "Connect Google Drive"**

This starts the OAuth flow:

1. Coach clicks Connect
2. Google login screen appears
3. Coach grants permission to read their Drive files
4. ClearPath stores the OAuth tokens
5. Coach can now import videos from their Drive

## Each coach has their own connection

You (admin) do **not** need to do anything per coach. Each coach connects their own Google account independently.

You only need **one** Google OAuth app (already set up with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`).

## n8n workflow

n8n handles the video processing pipeline: **one** n8n workflow handles **all** coaches. You do **not** create a separate workflow per coach.

The workflow:

1. ClearPath sends a webhook to n8n with: `{ videoUrl, workspaceId, videoId, callbackUrl }`
2. n8n downloads and processes the video
3. n8n sends the processed video back to ClearPath via the callback URL
4. ClearPath stores it and updates the video status

## Setup checklist for production

- [ ] `GOOGLE_CLIENT_ID` set in Vercel
- [ ] `GOOGLE_CLIENT_SECRET` set in Vercel
- [ ] `GOOGLE_REDIRECT_URI` set to `https://app.clearpath.com/api/integrations/google-drive/callback`
- [ ] n8n workflow deployed and running
- [ ] `N8N_WEBHOOK_URL` or relevant n8n URL env vars set in Vercel (see `lib/env.ts` and video routes for `N8N_CALLBACK_SECRET`, `N8N_SESSION_BOOKED_WEBHOOK_URL`, etc.)
- [ ] `N8N_CALLBACK_SECRET` set in Vercel

Integration status indicators (configured / not configured) are shown on **Admin → System** based on whether these environment variables are present.
