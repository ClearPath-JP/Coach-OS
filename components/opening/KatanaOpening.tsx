'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const SESSION_KEY = 'sensei-opening-played'
const TOTAL_DURATION = 2600

/**
 * Katana slash intro animation.
 * Plays once per browser session, then unmounts.
 * Respects prefers-reduced-motion.
 *
 * Sequence (2.4s):
 *   0-400ms   Stillness — grain + faint guide line
 *   300-900ms Blade descends from top
 *   900-1300ms Horizontal slash erupts from impact
 *   1200-2000ms Screen splits, halves peel away
 *   1800-2400ms Overlay fades out
 */
export function KatanaOpening() {
  const [show, setShow] = useState(true)

  useEffect(() => {
    // Skip if reduced motion or already played
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const alreadyPlayed = sessionStorage.getItem(SESSION_KEY) === '1'

    if (prefersReduced || alreadyPlayed) {
      setShow(false)
      return
    }

    sessionStorage.setItem(SESSION_KEY, '1')

    const timer = window.setTimeout(() => {
      setShow(false)
    }, TOTAL_DURATION)

    return () => window.clearTimeout(timer)
  }, [])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="katana-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden="true"
        >
          {/* Film grain texture */}
          <div className="katana-grain" />

          {/* Vertical guide line */}
          <div className="katana-guide" />

          {/* Blade descends */}
          <div className="katana-blade" />

          {/* Horizontal slash */}
          <div className="katana-slash" />

          {/* Burgundy impact glow */}
          <div className="katana-impact" />

          {/* Screen split — top half */}
          <div className="katana-split katana-split--top" />

          {/* Screen split — bottom half */}
          <div className="katana-split katana-split--bottom" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
