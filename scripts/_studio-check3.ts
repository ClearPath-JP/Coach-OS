import assert from 'node:assert'
import { splitCueIntoWords } from '../lib/studio/captions'
const w = splitCueIntoWords('the armbar detail', 1000, 4000)
assert.strictEqual(w.length, 3, '3 words')
assert.strictEqual(w[0]!.word, 'the', 'first word')
assert.strictEqual(w[0]!.startMs, 1000, 'first starts at cue start')
assert.strictEqual(w[2]!.endMs, 4000, 'last ends at cue end')
assert.ok(w[1]!.startMs >= w[0]!.endMs - 1, 'words are sequential')
assert.deepStrictEqual(splitCueIntoWords('   ', 0, 1000), [], 'empty text → no words')
console.log('OK karaoke word-split')
