'use client'

import { useEffect, type RefObject } from 'react'

const BLOB_COUNT = 5

type BlobVals = { tx: number; ty: number; s: number; o?: number }

/** Multi-frequency sinusoids for smooth, non-repeating-feeling drift (GPU: transform only). */
function blobField(t: number, phase: number): Omit<BlobVals, 'o'> {
  const tx =
    Math.sin(t * 0.31 + phase) * 62 +
    Math.sin(t * 0.097 + phase * 1.7) * 38 +
    Math.cos(t * 0.053 + phase * 0.9) * 22
  const ty =
    Math.cos(t * 0.29 + phase * 1.1) * 58 +
    Math.cos(t * 0.127 + phase * 0.6) * 34 +
    Math.sin(t * 0.071 + phase * 1.3) * 26
  const s =
    1 +
    0.09 * Math.sin(t * 0.23 + phase) +
    0.06 * Math.sin(t * 0.151 + phase * 0.8)
  return { tx, ty, s: Math.min(1.22, Math.max(0.88, s)) }
}

function applyVars(el: HTMLDivElement, values: BlobVals[]) {
  for (let i = 0; i < BLOB_COUNT; i++) {
    const n = i + 1
    const v = values[i]!
    el.style.setProperty(`--aurora-b${n}-tx`, `${v.tx.toFixed(2)}px`)
    el.style.setProperty(`--aurora-b${n}-ty`, `${v.ty.toFixed(2)}px`)
    el.style.setProperty(`--aurora-b${n}-s`, v.s.toFixed(4))
    if (v.o !== undefined) {
      el.style.setProperty(`--aurora-b${n}-o`, v.o.toFixed(4))
    }
  }
}

function clearVars(el: HTMLDivElement) {
  for (let n = 1; n <= BLOB_COUNT; n++) {
    el.style.removeProperty(`--aurora-b${n}-tx`)
    el.style.removeProperty(`--aurora-b${n}-ty`)
    el.style.removeProperty(`--aurora-b${n}-s`)
    el.style.removeProperty(`--aurora-b${n}-o`)
  }
}

const PHASES = [0, 2.11, 4.27, 1.03, 5.39]

/**
 * Drives login aurora blobs via CSS variables on the container (including ::before/::after).
 * Pauses when the tab is hidden; no-op when `prefers-reduced-motion: reduce`.
 */
export function useLoginAuroraMotion(auroraRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = auroraRef.current
    if (!el) return

    const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMq.matches) return

    let rafId = 0
    const t0 = performance.now()

    const tick = (now: number) => {
      if (document.hidden) {
        rafId = 0
        return
      }

      const t = (now - t0) / 1000
      const values: BlobVals[] = PHASES.map((phase, i) => {
        const base = blobField(t, phase)
        if (i === 3) {
          return {
            ...base,
            o: Math.min(0.72, Math.max(0.38, 0.54 + 0.16 * Math.sin(t * 0.28 + 1.2))),
          }
        }
        return base
      })

      applyVars(el, values)
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    const onVisibility = () => {
      if (!document.hidden && el.isConnected && rafId === 0) {
        rafId = requestAnimationFrame(tick)
      }
    }

    const onReducedChange = () => {
      if (reducedMq.matches) {
        cancelAnimationFrame(rafId)
        rafId = 0
        clearVars(el)
      } else if (rafId === 0 && el.isConnected) {
        rafId = requestAnimationFrame(tick)
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    reducedMq.addEventListener('change', onReducedChange)

    return () => {
      cancelAnimationFrame(rafId)
      document.removeEventListener('visibilitychange', onVisibility)
      reducedMq.removeEventListener('change', onReducedChange)
      clearVars(el)
    }
  }, [auroraRef])
}
