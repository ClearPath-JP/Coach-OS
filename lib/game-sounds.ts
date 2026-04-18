/**
 * Subtle synthesized UI sounds using Web Audio API.
 * No audio files needed — pure oscillator tones.
 * Globally mutable via localStorage 'coach-os-sound'.
 */

const STORAGE_KEY = 'coach-os-sound'

let ctx: AudioContext | null = null
let _muted: boolean | null = null

function isMuted(): boolean {
  if (typeof window === 'undefined') return true
  if (_muted === null) {
    try { _muted = localStorage.getItem(STORAGE_KEY) === 'off' } catch { _muted = false }
  }
  return _muted
}

export function setSoundEnabled(on: boolean) {
  _muted = !on
  try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off') } catch { /* ignore */ }
}

export function isSoundEnabled(): boolean {
  return !isMuted()
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined' || isMuted()) return null
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

/** Quick soft tap — button click */
export function playClick() {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(800, c.currentTime)
  gain.gain.setValueAtTime(0.04, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.06)
  osc.start(c.currentTime)
  osc.stop(c.currentTime + 0.06)
}

/** Two-note ascending chime — success / save complete */
export function playSuccess() {
  const c = getCtx()
  if (!c) return
  const play = (freq: number, delay: number) => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, c.currentTime + delay)
    gain.gain.setValueAtTime(0.05, c.currentTime + delay)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.2)
    osc.start(c.currentTime + delay)
    osc.stop(c.currentTime + delay + 0.2)
  }
  play(600, 0)
  play(900, 0.12)
}

/** Short low buzz — error / invalid action */
export function playError() {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = 'square'
  osc.frequency.setValueAtTime(200, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(150, c.currentTime + 0.15)
  gain.gain.setValueAtTime(0.03, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2)
  osc.start(c.currentTime)
  osc.stop(c.currentTime + 0.2)
}

/** Three-note ascending arpeggio — level up / achievement */
export function playLevelUp() {
  const c = getCtx()
  if (!c) return
  const play = (freq: number, delay: number) => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, c.currentTime + delay)
    gain.gain.setValueAtTime(0.06, c.currentTime + delay)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.25)
    osc.start(c.currentTime + delay)
    osc.stop(c.currentTime + delay + 0.25)
  }
  play(523, 0)     // C5
  play(659, 0.12)  // E5
  play(784, 0.24)  // G5
}
