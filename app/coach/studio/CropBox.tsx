'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Crop } from '@/lib/studio/timeline'

// Output frame is 9:16 portrait → box aspect width/height = 9/16.
const BOX_AR = 9 / 16

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

// The largest 9:16 (portrait) rectangle that fits inside W×H, in pixels.
function maxBox(W: number, H: number) {
  // Try full-height first; if it's too wide, fall back to full-width.
  let h = H
  let w = h * BOX_AR
  if (w > W) {
    w = W
    h = w / BOX_AR
  }
  return { w, h }
}

type Box = { left: number; top: number; w: number; h: number }

export function CropBox({
  thumbUrl,
  crop,
  onChange,
}: {
  thumbUrl: string | null
  crop: Crop | null
  onChange: (c: Crop | null) => void
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<{ W: number; H: number }>({ W: 0, H: 0 })

  // Latest props in a ref so the resize handler can re-derive the box without re-subscribing.
  const cropRef = useRef(crop)
  cropRef.current = crop

  const measure = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) setSize({ W: r.width, H: r.height })
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const { W, H } = size
  const ready = W > 0 && H > 0

  // Derive the on-screen box (pixels) from the normalized crop, or default to the
  // largest centered 9:16 box when crop is null. Guarded against unmeasured thumbnails.
  let box: Box | null = null
  if (ready) {
    if (crop) {
      box = { left: crop.x * W, top: crop.y * H, w: crop.w * W, h: crop.h * H }
    } else {
      const m = maxBox(W, H)
      box = { left: (W - m.w) / 2, top: (H - m.h) / 2, w: m.w, h: m.h }
    }
  }

  // Emit a normalized crop (fractions of the rendered thumbnail = fractions of the source).
  const emit = useCallback(
    (b: Box) => {
      if (W <= 0 || H <= 0) return
      onChange({
        x: clamp01(b.left / W),
        y: clamp01(b.top / H),
        w: clamp01(b.w / W),
        h: clamp01(b.h / H),
      })
    },
    [W, H, onChange],
  )

  // Keep a box of width bw,bh fully inside the thumbnail, returning clamped top/left.
  const clampPos = (left: number, top: number, bw: number, bh: number): Box => ({
    left: clamp(left, 0, Math.max(0, W - bw)),
    top: clamp(top, 0, Math.max(0, H - bh)),
    w: bw,
    h: bh,
  })

  // --- Drag (pan) -------------------------------------------------------------
  const dragRef = useRef<{ px: number; py: number; left: number; top: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    if (!box || !ready) return
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    dragRef.current = { px: e.clientX, py: e.clientY, left: box.left, top: box.top }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || !box) return
    const nextLeft = d.left + (e.clientX - d.px)
    const nextTop = d.top + (e.clientY - d.py)
    emit(clampPos(nextLeft, nextTop, box.w, box.h))
  }
  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    dragRef.current = null
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
  }

  // --- Zoom -------------------------------------------------------------------
  // zoom 0..1 maps box height from a small minimum up to the largest fitting box.
  const m = ready ? maxBox(W, H) : { w: 0, h: 0 }
  const minH = ready ? Math.max(40, m.h * 0.35) : 0 // don't let it shrink to nothing
  const zoomFromBox = (b: Box | null) => {
    if (!b || m.h <= minH) return 1
    return clamp01((b.h - minH) / (m.h - minH))
  }
  const currentZoom = zoomFromBox(box)

  const onZoom = (z: number) => {
    if (!box || !ready) return
    const newH = minH + clamp01(z) * (m.h - minH)
    const newW = newH * BOX_AR
    // Resize about the box center, then re-clamp inside the thumbnail.
    const cx = box.left + box.w / 2
    const cy = box.top + box.h / 2
    emit(clampPos(cx - newW / 2, cy - newH / 2, newW, newH))
  }

  if (!thumbUrl) {
    return (
      <div className="grid h-40 w-full max-w-[280px] place-items-center rounded-xl border border-dashed border-white/15 bg-[var(--bg-subtle)] text-sm text-[var(--text-quaternary)]">
        No preview
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div
        ref={wrapRef}
        className="relative mx-auto w-full max-w-[280px] select-none overflow-hidden rounded-xl border border-white/15 bg-black"
        style={{ touchAction: 'none' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbUrl}
          alt="Clip frame"
          onLoad={measure}
          draggable={false}
          className="block h-auto w-full"
        />

        {box && (
          <>
            {/* Spotlight dim: a transparent rect over the crop region whose large outset
                box-shadow darkens everything outside it. Clipped by the parent's
                overflow-hidden. Non-interactive and un-rounded so no edge pixels leak. */}
            <div
              aria-hidden
              className="pointer-events-none absolute shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
              style={{
                left: `${box.left}px`,
                top: `${box.top}px`,
                width: `${box.w}px`,
                height: `${box.h}px`,
              }}
            />
            {/* Draggable crop window (border + handle target), above the dim. */}
            <div
              role="slider"
              aria-label="Reframe region"
              aria-valuetext="Drag to reposition the 9:16 crop"
              tabIndex={0}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className="absolute cursor-move touch-none border-2 border-[var(--accent)]"
              style={{
                left: `${box.left}px`,
                top: `${box.top}px`,
                width: `${box.w}px`,
                height: `${box.h}px`,
              }}
            >
              <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                9:16
              </span>
            </div>
          </>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-[var(--text-quaternary)]">
        <span className="w-12">Zoom</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={currentZoom}
          onChange={(e) => onZoom(Number(e.target.value))}
          disabled={!ready}
          className="flex-1 accent-[var(--accent)]"
        />
      </label>

      <button
        type="button"
        onClick={() => onChange(null)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[var(--bg-subtle)] px-3 py-1.5 text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]"
      >
        Reset to center
      </button>
    </div>
  )
}
