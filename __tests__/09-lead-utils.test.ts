import { normalizeLeadKey } from '@/lib/leads-interactions'
import { leadsToCsv } from '@/app/coach/leads/leads-csv'

// ============================================================================
// Task 2: normalizeLeadKey utility
// ============================================================================
describe('normalizeLeadKey', () => {
  it('keys by platform + lowercased handle without @', () => {
    expect(normalizeLeadKey({ platform: 'instagram', handle: '@MariaMoves', url: 'x' }))
      .toBe('instagram:mariamoves')
  })
  it('falls back to normalized url when no handle', () => {
    expect(normalizeLeadKey({ platform: 'website', handle: null, url: 'https://Foo.com/Bar/' }))
      .toBe('website:foo.com/bar')
  })
})

// ============================================================================
// Task 7: leadsToCsv export helper
// ============================================================================
describe('leadsToCsv', () => {
  it('emits a header and quotes fields containing commas', () => {
    const csv = leadsToCsv([
      { name: 'A, Inc', handle: '@a', leadType: 'business', platform: 'instagram', email: null, status: 'new', reason: 'hi', url: 'https://x' },
    ])
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('Name,Handle,Type,Platform,Email,Status,Why,URL')
    expect(lines[1]).toBe('"A, Inc",@a,business,instagram,,new,hi,https://x')
  })
})
