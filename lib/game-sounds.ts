/**
 * Subtle synthesized UI sounds using Web Audio API.
 * No audio files needed — pure oscillator tones.
 */

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Soft high-pitched tick — menu item hover */
export function playHover() {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(1400, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(900, c.currentTime + 0.05)
  gain.gain.setValueAtTime(0.03, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.07)
  osc.start(c.currentTime)
  osc.stop(c.currentTime + 0.07)
}

/** Rising confirmation tone — menu item select / navigation */
export function playSelect() {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(600, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(1000, c.currentTime + 0.12)
  gain.gain.setValueAtTime(0.05, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18)
  osc.start(c.currentTime)
  osc.stop(c.currentTime + 0.18)
}

/** Soft descending tone — navigate back / home */
export function playBack() {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(900, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(500, c.currentTime + 0.12)
  gain.gain.setValueAtTime(0.04, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15)
  osc.start(c.currentTime)
  osc.stop(c.currentTime + 0.15)
}
