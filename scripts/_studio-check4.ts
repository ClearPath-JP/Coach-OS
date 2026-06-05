import assert from 'node:assert'
import { CreateScheduleSchema, PLATFORMS } from '../lib/studio/scheduled'

assert.ok(PLATFORMS.includes('instagram'), 'has instagram')

const ok = CreateScheduleSchema.safeParse({
  videoId: '11111111-1111-4111-8111-111111111111',
  platforms: ['instagram'],
  caption: 'hi',
  scheduledAt: '2026-07-01T15:00:00.000Z',
})
assert.ok(ok.success, 'valid create parses')

assert.ok(
  !CreateScheduleSchema.safeParse({
    videoId: 'x',
    platforms: [],
    caption: '',
    scheduledAt: 'nope',
  }).success,
  'invalid rejected',
)

assert.ok(
  !CreateScheduleSchema.safeParse({
    videoId: '11111111-1111-4111-8111-111111111111',
    platforms: ['myspace'],
    caption: 'hi',
    scheduledAt: '2026-07-01T15:00:00.000Z',
  }).success,
  'bad platform rejected',
)

console.log('OK scheduled schema')
