# Video Processing: n8n vs Direct Stream

## Current approach: Direct streaming

ClearPath streams videos directly from Google Drive without downloading or processing them on our infrastructure.

### How it works

1. Coach keeps videos in their Google Drive folder.
2. **Import** saves only the Drive file ID and metadata (name, size, thumbnail URL, etc.) in the database — no video bytes in Supabase Storage.
3. **Playback** uses `GET /api/videos/[id]/stream`, which checks permissions, refreshes the workspace OAuth token, and proxies the `alt=media` response from the Drive API to the browser (including `Range` for seeking).
4. There are no Supabase Storage charges for those video bytes.
5. There is no transcoding pipeline; videos are available as soon as they are imported.

### n8n is NOT needed for this approach

Basic playback does not require n8n, CloudConvert, or webhooks.

## When you would need n8n (or similar)

Only if you want to:

- Compress or transcode videos (e.g. uniform MP4, lower bitrate).
- Generate HLS or DASH for adaptive streaming.
- Strip metadata or add watermarks.
- Push processed files to your own storage and serve from there.

## Recommendation

Ship with direct Drive streaming first. Add n8n (or another worker) only if coaches report slow playback, device compatibility issues, or oversized source files.

## If you add n8n later

The stream URL implementation could switch from “proxy Drive” to “public or signed URL for a processed file” (e.g. in Supabase Storage). The `VideoPlayer` component can keep the same shape: it uses a URL that ultimately returns video bytes; only the source of that URL changes.
