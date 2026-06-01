import { normalizeLeadKey } from './leads-interactions'

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
