# Video Library Implementation & Scaling Strategy

## Current Approach (MVP)
- Coach connects Google Drive
- Automation watches folder and syncs videos to site
- Testing with first coach

## MVP Assessment
Works fine for 1-5 coaches. Proceed with testing.

## Scaling Issues (5+ coaches)

### Performance
- Google Drive not optimized for video streaming
- Client buffering issues = lower engagement
- No bitrate optimization for mobile/slow connections

### Storage & Bandwidth Costs
- Video files are heavy (1GB+ per hour of content)
- Direct Drive streaming = bandwidth costs
- As coaches add more videos, hosting costs spike
- Unclear cost allocation (who pays?)

### API Rate Limits
- Google Drive API has quotas
- At 20+ coaches × 100+ videos, sync delays occur
- Automation breaks or slows significantly

### Missing Features
- No watch analytics (can't track engagement)
- No quality/format optimization
- No mobile-friendly encoding

## Recommended Scaling Path

### Phase 1 (Current - MVP)
- Keep Google Drive sync for testing
- Get real data from first coach
- Measure: video uploads, watch time, complaints

### Phase 2 (5+ coaches)
Migrate to a video platform:
- **Mux** (recommended): $0.04-0.10 per GB streamed
- **Bunny CDN**: ~$0.01-0.03 per GB
- **Vimeo**: More expensive but all-in-one

### Migration Flow
1. Coach uploads video to your app UI (or Drive)
2. System pushes to video platform (Mux/Bunny)
3. Platform handles:
   - Auto-encoding (1080p, 720p, mobile)
   - CDN distribution (fast globally)
   - HLS/DASH streaming
4. Your app embeds player from platform
5. You get watch analytics via API

### Cost Model
- Pay per GB streamed (not stored)
- Example: 10 coaches, 100 videos (50GB), 1000 streams/month
  - Mux: ~$40-100/month
  - Bunny: ~$10-30/month
- Add $0.50-1.00/month per coach to Standard/Premium tiers to cover

## Why Video Platform > DIY Streaming
- Encoding handled (no server load)
- Global CDN (coaches & clients worldwide)
- Playback analytics built-in
- Mobile optimization automatic
- Predictable costs
- Industry standard (Netflix, YouTube use this approach)

## Implementation Priority
1. Test Google Drive sync with first coach (now)
2. Monitor: upload frequency, total data, watch patterns
3. Decide on platform in next 2-4 weeks based on real usage
4. Don't over-engineer yet — let data guide decision
