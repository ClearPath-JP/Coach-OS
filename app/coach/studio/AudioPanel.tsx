'use client'
import { useRef, useState } from 'react'
import type { ProjectAudio } from '@/lib/studio/timeline'

async function uploadAudio(kind: 'music' | 'voiceover', file: Blob): Promise<string> {
  const fd = new FormData()
  fd.append('kind', kind)
  fd.append('file', file, kind === 'music' ? 'music' : 'voiceover.webm')
  const res = await fetch('/api/studio/audio', { method: 'POST', credentials: 'include', body: fd })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error ?? 'Upload failed')
  return j.data.path as string
}

export function AudioPanel({ audio, onChange }: { audio: ProjectAudio; onChange: (a: ProjectAudio) => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const setVol = (k: 'clip' | 'music' | 'voiceover', v: number) => onChange({ ...audio, volumes: { ...audio.volumes, [k]: v } })

  async function onMusic(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setErr(null); setBusy('music')
    try { onChange({ ...audio, music: await uploadAudio('music', f) }) } catch (x) { setErr(x instanceof Error ? x.message : 'Upload failed') } finally { setBusy(null) }
  }
  async function startRec() {
    setErr(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (ev) => { if (ev.data.size) chunksRef.current.push(ev.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        setBusy('voiceover')
        try { onChange({ ...audio, voiceover: await uploadAudio('voiceover', blob) }) } catch (x) { setErr(x instanceof Error ? x.message : 'Upload failed') } finally { setBusy(null) }
      }
      recRef.current = rec; rec.start(); setRecording(true)
    } catch { setErr('Microphone access denied') }
  }
  function stopRec() { recRef.current?.stop(); setRecording(false) }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 p-3">
      <div className="text-sm font-medium">Audio</div>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="cursor-pointer rounded-lg border border-white/15 px-3 py-1.5">
          {audio.music ? 'Replace music' : 'Add music'}
          <input type="file" accept="audio/*" className="hidden" onChange={onMusic} disabled={busy === 'music'} />
        </label>
        {audio.music && <button onClick={() => onChange({ ...audio, music: null })} className="opacity-60 hover:opacity-100">Remove</button>}
        {busy === 'music' && <span className="opacity-60">Uploading…</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {!recording
          ? <button onClick={startRec} className="rounded-lg border border-white/15 px-3 py-1.5">{audio.voiceover ? 'Re-record voiceover' : 'Record voiceover'}</button>
          : <button onClick={stopRec} className="rounded-lg border border-red-500/60 px-3 py-1.5 text-red-300">Stop ●</button>}
        {audio.voiceover && !recording && <button onClick={() => onChange({ ...audio, voiceover: null })} className="opacity-60 hover:opacity-100">Remove</button>}
        {busy === 'voiceover' && <span className="opacity-60">Saving…</span>}
      </div>
      <div className="space-y-2 pt-1">
        {(['clip', 'music', 'voiceover'] as const).map((k) => (
          <label key={k} className="flex items-center gap-2 text-xs">
            <span className="w-20 capitalize opacity-70">{k === 'clip' ? 'Clip sound' : k}</span>
            <input type="range" min={0} max={1} step={0.05} value={audio.volumes[k]} onChange={(e) => setVol(k, Number(e.target.value))} className="flex-1" />
            <span className="w-8 text-right opacity-60">{Math.round(audio.volumes[k] * 100)}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
