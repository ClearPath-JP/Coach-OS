// Custom Jest test sequencer to enforce deterministic order across suites.
//
// Some suites rely on persisted state written by earlier suites (e.g. 05 -> 06).
// Jest's default discovery order can be non-deterministic, even with `--runInBand`.

function getTestPath(test) {
  if (typeof test === 'string') return test
  return test?.path || test?.testPath || test?.filePath || ''
}

function getOrderNumber(testPath) {
  // Match: __tests__/06-client-ui-flows.test.ts
  const m = testPath.match(/__tests__[\\/](\d+)-.*\.test\.[jt]sx?$/)
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER
}

module.exports = class ClearPathTestSequencer {
  sort(tests) {
    const snapshot = Array.from(tests)
    const withMeta = snapshot.map((t, idx) => {
      const testPath = getTestPath(t)
      return {
        t,
        idx,
        orderNumber: getOrderNumber(testPath),
        testPath,
      }
    })

    withMeta.sort((a, b) => {
      // Primary: numeric prefix (01..06)
      const d = a.orderNumber - b.orderNumber
      if (d !== 0) return d

      // Secondary: path for stability
      const p = a.testPath.localeCompare(b.testPath)
      if (p !== 0) return p

      // Final: original index
      return a.idx - b.idx
    })

    return withMeta.map((x) => x.t)
  }

  // Jest core expects sequencer instances to support caching of test results.
  // We don't implement custom caching, so this is a no-op.
  cacheResults() {
    // no-op
  }
}

