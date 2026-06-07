// Pure helper (no 'server-only') so it's unit-testable under tsx.
// Picks the sharpest MP4 fallback rendition Bunny produced. Bunny's
// `availableResolutions` is a comma list like "240p,360p,480p,720p,1080p".
const RES_RANK: Record<string, number> = {
  '2160p': 2160, '1440p': 1440, '1080p': 1080, '720p': 720, '480p': 480, '360p': 360, '240p': 240,
}

export function pickBestMp4Resolution(available: string[]): string {
  const ranked = available
    .map((r) => r.trim())
    .filter((r) => r in RES_RANK)
    .sort((a, b) => (RES_RANK[b] ?? 0) - (RES_RANK[a] ?? 0))
  return ranked[0] ?? '720p'
}
