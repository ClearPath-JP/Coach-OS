import assert from 'node:assert'
import { ProjectAudioSchema, audioPublicPath } from '../lib/studio/timeline'
import { validateAudioMagicBytes } from '../lib/file-validation'

const a = ProjectAudioSchema.parse({ music: 'ws1/abc.mp3', voiceover: null, volumes: { clip: 1, music: 0.4, voiceover: 1 } })
assert.strictEqual(a.music, 'ws1/abc.mp3', 'music path kept')
assert.strictEqual(a.voiceover, null, 'voiceover null ok')
assert.ok(ProjectAudioSchema.safeParse({}).success, 'empty audio defaults ok')
assert.ok(!ProjectAudioSchema.safeParse({ volumes: { clip: 2, music: 0, voiceover: 0 } }).success, 'volume>1 rejected')
assert.strictEqual(audioPublicPath('ws1', 'ws1/abc.mp3'), 'ws1/abc.mp3', 'in-workspace path ok')
assert.strictEqual(audioPublicPath('ws1', 'ws2/abc.mp3'), null, 'cross-workspace path rejected')
assert.strictEqual(audioPublicPath('ws1', null), null, 'null path ok')
assert.strictEqual(validateAudioMagicBytes(Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00])), true, 'ID3 mp3 ok')
assert.strictEqual(validateAudioMagicBytes(Buffer.from([0x00, 0x01, 0x02, 0x03])), false, 'garbage rejected')
console.log('OK studio audio schema + validation')
