/**
 * One-off: make the `assignment-submissions` storage bucket PRIVATE (student uploads were
 * world-readable by public URL). Serve code already mints signed URLs. Run from repo root:
 *   npx tsx scripts/make-submissions-private.ts
 * Reversible: set { public: true } to roll back.
 */
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
config({ path: path.join(root, '.env.local') })
config({ path: path.join(root, '.env') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const { error } = await sb.storage.updateBucket('assignment-submissions', { public: false })
if (error) {
  console.error('ERROR updating bucket:', error.message)
  process.exit(1)
}

const { data: b, error: getErr } = await sb.storage.getBucket('assignment-submissions')
if (getErr) {
  console.error('Updated, but could not verify:', getErr.message)
  process.exit(1)
}
console.log(`OK — assignment-submissions public = ${b?.public}`)
