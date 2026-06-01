'use client'

import { useRef, useState } from 'react'
import { Upload as TusUpload } from 'tus-js-client'
import { UploadCloud, Loader2, CheckCircle2, X } from 'lucide-react'

type UploadState = 'idle' | 'creating' | 'uploading' | 'processing' | 'done' | 'failed'

/**
 * Direct browser→Bunny video upload for the coach video library.
 * Reuses the proven TUS pipeline (POST /bunny/create → tus-js-client → poll
 * /bunny/status). Sends the file size so the create route can enforce the plan
 * storage cap. Calls onUploaded() when Bunny finishes so the page refreshes.
 */
export function VideoUploader({ onUploaded }: { onUploaded: () => void }) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<UploadState>('idle')
  const [pct, setPct] = useState(0)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  function reset() {
    setState('idle')
    setPct(0)
    setFileName('')
    setError(null)
  }

  function close() {
    cancelledRef.current = true
    setOpen(false)
    // Let the modal animate out before clearing.
    setTimeout(reset, 200)
  }

  async function pollStatus(guid: string) {
    for (let i = 0; i < 90 && !cancelledRef.current; i++) {
      await new Promise((r) => setTimeout(r, 4000))
      if (cancelledRef.current) return
      try {
        const res = await fetch(`/api/coach/promote/bunny/status?guid=${encodeURIComponent(guid)}`, {
          credentials: 'include',
        })
        if (!res.ok) continue
        const d = (await res.json()).data as { ready?: boolean; failed?: boolean }
        if (d.failed) {
          setState('failed')
          setError('Bunny could not process this clip. Try a different file.')
          return
        }
        if (d.ready) {
          setState('done')
          onUploaded()
          return
        }
      } catch {
        /* keep polling */
      }
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return
    cancelledRef.current = false
    setError(null)
    setPct(0)
    setFileName(file.name)
    setState('creating')
    void fetch('/api/coach/promote/bunny/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title: file.name, fileSizeBytes: file.size }),
    })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as {
          data?: {
            videoId: string
            libraryId: string
            tusEndpoint: string
            authorizationSignature: string
            authorizationExpire: number
          }
          error?: string
        }
        if (!res.ok || !json.data) {
          setError(json.error ?? 'Upload could not start')
          setState('failed')
          return
        }
        const { videoId, libraryId, tusEndpoint, authorizationSignature, authorizationExpire } = json.data
        setState('uploading')
        const upload = new TusUpload(file, {
          endpoint: tusEndpoint,
          retryDelays: [0, 1000, 3000, 5000],
          headers: {
            AuthorizationSignature: authorizationSignature,
            AuthorizationExpire: String(authorizationExpire),
            LibraryId: String(libraryId),
            VideoId: videoId,
          },
          metadata: { filetype: file.type || 'video/mp4', title: file.name },
          onError: () => {
            setError('Upload failed — try again')
            setState('failed')
          },
          onProgress: (sent, total) => setPct(total ? Math.round((sent / total) * 100) : 0),
          onSuccess: () => {
            setState('processing')
            void pollStatus(videoId)
          },
        })
        upload.start()
      })
      .catch(() => {
        setError('Upload could not start — try again')
        setState('failed')
      })
  }

  const busy = state === 'creating' || state === 'uploading' || state === 'processing'

  return (
    <>
      <Button onClick={() => setOpen(true)} />

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal>
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-default)] bg-[var(--bg-app)] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Upload a video</h2>
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="rounded-md p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {state === 'idle' || state === 'failed' ? (
              <>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-8 text-center transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--bg-muted)]">
                  <UploadCloud className="size-7 text-[var(--text-tertiary)]" />
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Choose a video file</span>
                  <span className="text-[11px] text-[var(--text-quaternary)]">
                    MP4/MOV — hosted on Bunny + auto-transcribed. Counts toward your storage.
                  </span>
                  <input type="file" accept="video/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                </label>
                {error && (
                  <p role="alert" className="mt-3 text-xs text-[var(--error)]">
                    {error}
                  </p>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-4">
                <p className="mb-2 truncate text-[13px] font-medium text-[var(--text-secondary)]">{fileName}</p>
                {state === 'uploading' ? (
                  <>
                    <p className="mb-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <Loader2 className="size-4 animate-spin" /> Uploading… {pct}%
                    </p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
                      <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </>
                ) : state === 'processing' ? (
                  <p className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                    <Loader2 className="size-4 animate-spin" /> Transcoding + transcribing on Bunny… (usually 1–3 min)
                  </p>
                ) : state === 'creating' ? (
                  <p className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                    <Loader2 className="size-4 animate-spin" /> Starting upload…
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--success)]">
                      <CheckCircle2 className="size-4" /> Uploaded &amp; added to your library
                    </p>
                    <button
                      type="button"
                      onClick={close}
                      className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--text-on-accent)] transition-colors hover:bg-[var(--accent-hover)]"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )

  // Trigger button — styled to match the page's other header buttons.
  function Button({ onClick }: { onClick: () => void }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex h-8 min-h-8 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 text-[13px] font-medium text-[var(--text-on-accent)] transition-colors hover:bg-[var(--accent-hover)]"
      >
        <UploadCloud className="size-4" /> Upload video
      </button>
    )
  }
}
