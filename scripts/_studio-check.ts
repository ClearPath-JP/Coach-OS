import assert from 'node:assert'
import { TimelineSchema, ProjectAudioSchema, totalDurationSec, clipFrameRanges, FPS } from '../lib/studio/timeline'
import { coverStyle } from '../lib/studio/crop'
import { offsetCues } from '../lib/studio/captions'

// RFC-4122 v4 UUIDs (version nibble=4, variant nibble in [89ab])
const UUID_A = '11111111-1111-4111-8111-111111111111'
const UUID_B = '22222222-2222-4222-8222-222222222222'
const tl = [
  { sourceVideoId: UUID_A, inSec: 0, outSec: 3, captionsOn: true },
  { sourceVideoId: UUID_B, inSec: 1, outSec: 5.5, captionsOn: false },
]
assert.ok(TimelineSchema.safeParse(tl).success, 'valid timeline should parse')
assert.ok(!TimelineSchema.safeParse([{ sourceVideoId: UUID_A, inSec: 3, outSec: 3 }]).success, 'out<=in rejects')
assert.ok(ProjectAudioSchema.safeParse({}).success, 'empty audio ok')
assert.ok(ProjectAudioSchema.safeParse({ volumes: { clip: 1, music: 0.5, voiceover: 1 } }).success, 'audio volumes ok')
assert.strictEqual(totalDurationSec(tl), 7.5, 'total duration sums clip lengths')
const ranges = clipFrameRanges(tl)
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
assert.deepStrictEqual(ranges[0]!, { fromFrame: 0, durationInFrames: 90 }, 'clip0 frames')
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
assert.deepStrictEqual(ranges[1]!, { fromFrame: 90, durationInFrames: 135 }, 'clip1 frames')
const s0 = coverStyle(null)
assert.strictEqual(s0.objectFit, 'cover', 'cover by default')
const s1 = coverStyle({ x: 0.25, y: 0, w: 0.5, h: 1 })
assert.ok(typeof s1.transform === 'string' && s1.transform.includes('scale'), 'crop yields scale transform')
const cues = [{ startMs: 1000, endMs: 2000, text: 'a' }, { startMs: 4000, endMs: 5000, text: 'b' }]
const out = offsetCues(cues, { inSec: 0.5, outSec: 2.0, startSec: 3.0 })
assert.strictEqual(out.length, 1, 'only in-window cue kept')
assert.strictEqual(out[0]!.text, 'a', 'kept cue a')
assert.ok(out[0]!.startMs >= 3000, 'cue shifted onto timeline')
console.log('OK studio/timeline + crop + captions')
