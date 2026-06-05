'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type RS = 'idle' | 'rendering' | 'done' | 'failed'

function isSafeUrl(url: string | null): url is string {
  if (!url) return false
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

export function RenderPanel({ projectId, canRender, onBeforeRender, title }: {
  projectId: string; canRender: boolean; onBeforeRender: () => Promise<void>; title: string
}) {
  const router = useRouter()
  const [state, setState] = useState<RS>('idle')
  const [progress, setProgress] = useState(0)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [savedToLib, setSavedToLib] = useState(false)
  const [savedVideoId, setSavedVideoId] = useState<string | null>(null)
  const cancelled = useRef(false)

  // Cancel polling on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => { cancelled.current = true }
  }, [])

  async function poll(id: string) {
    for (let i = 0; i < 200 && !cancelled.current; i++) {
      await new Promise((r) => setTimeout(r, 3000))
      try {
        const res = await fetch(`/api/coach/promote/render/status?editId=${encodeURIComponent(id)}`, { credentials: 'include' })
        const body = await res.json()
        const d = body.data as { status: RS; progress: number; outputUrl: string | null; error: string | null } | undefined
        if (!d) continue
        setProgress(d.progress ?? 0)
        if (d.status === 'done' && isSafeUrl(d.outputUrl)) { setOutputUrl(d.outputUrl); setState('done'); return }
        if (d.status === 'failed') { setErr(d.error ?? 'Render failed'); setState('failed'); return }
      } catch {
        // transient network error — keep polling
      }
    }
  }

  async function render() {
    setErr(null); await onBeforeRender()
    setState('rendering'); setProgress(0); cancelled.current = false
    try {
      const res = await fetch('/api/studio/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ projectId }) })
      const j = await res.json()
      if (!res.ok) { setErr(j?.error ?? 'Could not start'); setState('failed'); return }
      const id: string | undefined = j?.data?.editId
      if (!id) { setErr('Invalid response from server'); setState('failed'); return }
      setEditId(id); void poll(id)
    } catch {
      setErr('Network error — could not start render'); setState('failed')
    }
  }

  async function saveToLibrary() {
    if (!editId) return
    try {
      const res = await fetch('/api/studio/save-to-library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ editId, title }) })
      if (res.ok) {
        const j = await res.json().catch(() => ({}))
        const vid: string | undefined = (j as { data?: { videoId?: string } }).data?.videoId
        setSavedToLib(true)
        if (vid) setSavedVideoId(vid)
      } else {
        const j = await res.json().catch(() => ({}))
        setErr((j as { error?: string })?.error ?? 'Could not save')
      }
    } catch {
      setErr('Network error — could not save to library')
    }
  }

  const safeOutputUrl = isSafeUrl(outputUrl) ? outputUrl : null

  return (
    <div className="space-y-2">
      <button onClick={render} disabled={!canRender || state === 'rendering'} className="btn-primary-gloss inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50">
        {state === 'rendering' ? `Rendering ${Math.round(progress * 100)}%` : 'Render'}
      </button>
      {state === 'rendering' && <div className="h-1.5 w-full rounded bg-white/10"><div className="h-full rounded" style={{ width: `${Math.round(progress * 100)}%`, backgroundColor: 'var(--accent)' }} /></div>}
      {err && <p className="text-sm text-red-400">{err}</p>}
      {state === 'done' && safeOutputUrl && (
        <div className="space-y-2">
          <video src={safeOutputUrl} controls className="aspect-[9/16] w-full max-w-[240px] rounded-xl" />
          <div className="flex gap-2">
            <a href={safeOutputUrl} download className="rounded-xl border border-white/15 px-3 py-1.5 text-sm">Download</a>
            <button onClick={saveToLibrary} disabled={savedToLib} className="rounded-xl border border-white/15 px-3 py-1.5 text-sm disabled:opacity-50">{savedToLib ? 'Saved ✓' : 'Save to library'}</button>
            {savedToLib && savedVideoId && (
              <button
                onClick={() => router.push('/coach/studio/scheduled?video=' + encodeURIComponent(savedVideoId))}
                className="btn-primary-gloss inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-medium text-white shadow-sm"
              >
                Schedule this
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
