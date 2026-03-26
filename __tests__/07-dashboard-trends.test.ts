import { formatTrendLabel, trendFromCounts } from '@/lib/dashboard-trends'

describe('dashboard-trends', () => {
  it('trendFromCounts returns null when both zero', () => {
    expect(trendFromCounts(0, 0)).toBeNull()
  })

  it('trendFromCounts handles growth from zero baseline', () => {
    expect(trendFromCounts(3, 0)).toEqual({ pct: 100, up: true })
  })

  it('trendFromCounts rounds percent change', () => {
    expect(trendFromCounts(11, 10)).toEqual({ pct: 10, up: true })
    expect(trendFromCounts(9, 10)).toEqual({ pct: 10, up: false })
  })

  it('formatTrendLabel signs', () => {
    expect(formatTrendLabel({ pct: 5, up: true })).toEqual({ label: '+5%', up: true })
    expect(formatTrendLabel({ pct: 12, up: false })).toEqual({ label: '-12%', up: false })
  })
})
