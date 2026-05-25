'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const SESSION_KEY = 'sensei-opening-played'
const TOTAL_DURATION = 600

/**
 * Katana slash intro animation.
 * Plays once per browser session, then unmounts.
 * Respects prefers-reduced-motion.
 *
 * Sequence (~780ms total):
 *   0-120ms   Guide line fades in
 *   40-240ms  Blade descends from top
 *   210-410ms Impact glow + horizontal slash erupts
 *   360-590ms Screen splits, halves peel away
 *   600ms     Unmount; 180ms overlay fade reveals the page
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
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
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
