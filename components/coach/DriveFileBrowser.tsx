'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

type DriveListFile = {
  id: string
  name: string
  size: number | null
  mimeType: string | null
  thumbnailLink: string | null
  webViewLink: string | null
  createdTime: string | null
  modifiedTime: string | null
  durationSeconds: number | null
  alreadyImported: boolean
  libraryVideoId: string | null
}

export type DriveFileBrowserProps = {
  open: boolean
  onClose: () => void
  onImported?: (count: number) => void
  /** One-tap pick: import (or use library id) then attach to program content block */
  pickForProgramBlock?: boolean
  onProgramBlockPicked?: (args: { videoId: string; title: string }) => void | Promise<void>
}

function formatBytes(n: number | null): string {
  if (n == null || Number.isNaN(n)) return '—'
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`
  if (n >= 1e6) return `${Math.round(n / 1e6)} MB`
  if (n >= 1e3) return `${Math.round(n / 1e3)} KB`
  return `${n} B`
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return '—'
  }
}

export function DriveFileBrowser({
  open,
  onClose,
  onImported,
  pickForProgramBlock = false,
  onProgramBlockPicked,
}: DriveFileBrowserProps) {
  const [files, setFiles] = useState<DriveListFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [pickingId, setPickingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    setImportMsg(null)
    try {
      const r = await fetch('/api/integrations/google-drive/files', { credentials: 'include' })
      const j = await r.json()
      if (!r.ok) {
        setError(typeof j.error === 'string' ? j.error : 'Could not load Drive files')
        setFiles([])
        return
      }
      const raw = (j.data?.files as DriveListFile[]) ?? []
      setFiles(
        raw.map((f) => ({
          ...f,
          libraryVideoId: f.libraryVideoId ?? null,
        }))
      )
    } catch {
      setError('Could not load Drive files')
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setSelected(new Set())
    setPickingId(null)
    void load()
  }, [open, load])

  const pickFileForProgram = async (f: DriveListFile) => {
    if (!onProgramBlockPicked || pickingId) return
    setImportMsg(null)
    setError(null)
    setPickingId(f.id)
    try {
      if (f.alreadyImported && f.libraryVideoId?.trim()) {
        await onProgramBlockPicked({ videoId: f.libraryVideoId.trim(), title: f.name })
        return
      }
      const r = await fetch('/api/videos/import-from-drive', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driveFileId: f.id,
          driveFileName: f.name,
          driveMimeType: f.mimeType || 'video/mp4',
          driveThumbnailUrl: f.thumbnailLink,
          driveWebViewLink: f.webViewLink,
          fileSizeBytes: f.size ?? 0,
          durationSeconds: f.durationSeconds,
        }),
      })
      const j = (await r.json().catch(() => ({}))) as {
        data?: { video?: { id: string }; videoId?: string; alreadyImported?: boolean }
        error?: string
      }
      if (!r.ok) {
        setError(typeof j.error === 'string' ? j.error : 'Could not import video')
        return
      }
      const videoId = j.data?.video?.id ?? j.data?.videoId
      if (!videoId) {
        setError('Could not import video')
        return
      }
      await onProgramBlockPicked({ videoId, title: f.name })
    } catch {
      setError('Could not import video')
    } finally {
      setPickingId(null)
    }
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const importSelected = async () => {
    const toImport = files.filter((f) => selected.has(f.id) && !f.alreadyImported)
    if (toImport.length === 0) return
    setImporting(true)
    setImportMsg(null)
    let ok = 0
    const errors: string[] = []
    for (const f of toImport) {
      try {
        const r = await fetch('/api/videos/import-from-drive', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driveFileId: f.id,
            driveFileName: f.name,
            driveMimeType: f.mimeType || 'video/mp4',
            driveThumbnailUrl: f.thumbnailLink,
            driveWebViewLink: f.webViewLink,
            fileSizeBytes: f.size ?? 0,
            durationSeconds: f.durationSeconds,
          }),
        })
        const j = (await r.json().catch(() => ({}))) as { data?: { alreadyImported?: boolean }; error?: string }
        if (!r.ok) {
          errors.push(typeof j.error === 'string' ? j.error : `Failed: ${f.name}`)
        } else if (!j.data?.alreadyImported) {
          ok += 1
        }
      } catch {
        errors.push(`Failed: ${f.name}`)
      }
    }
    setImporting(false)
    setSelected(new Set())
    if (ok > 0) {
      setImportMsg(`${ok} video${ok === 1 ? '' : 's'} imported ✓`)
      onImported?.(ok)
    }
    if (errors.length) setImportMsg((prev) => [prev, errors[0]].filter(Boolean).join(' '))
    void load()
  }

  const selectableCount = files.filter((f) => !f.alreadyImported).length
  const selectedToImport = files.filter((f) => selected.has(f.id) && !f.alreadyImported).length

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={pickForProgramBlock ? 'Browse Google Drive' : 'Import from Google Drive'}
      className="w-full max-w-none md:max-w-3xl"
    >
      <p className="text-sm text-[var(--color-muted)] mb-3">
        {pickForProgramBlock
          ? 'Choose a video to import into your library and add to this module.'
          : 'Videos stay in your Drive. Korva only stores the file ID and streams through your workspace connection.'}
      </p>

      {loading && <p className="text-sm text-[var(--color-muted)]">Loading folder…</p>}
      {error && <p className="text-sm text-[var(--color-error)] mb-2">{error}</p>}
      {importMsg && <p className="text-sm text-[var(--color-success)] mb-2">{importMsg}</p>}

      {!loading && !error && files.length === 0 && (
        <p className="text-sm text-[var(--color-muted)]">No video files in this folder.</p>
      )}

      {!loading && files.length > 0 && (
        <div className="max-h-[55vh] overflow-auto space-y-2 border border-[var(--color-border)] rounded-lg p-2">
          {files.map((f) => (
            <div
              key={f.id}
              className={cn(
                'flex gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-2 items-start',
                pickForProgramBlock && 'transition-colors',
                pickForProgramBlock && pickingId !== f.id && 'hover:bg-[var(--color-surface)]/80 cursor-pointer'
              )}
              role={pickForProgramBlock ? 'button' : undefined}
              tabIndex={pickForProgramBlock ? 0 : undefined}
              onClick={
                pickForProgramBlock
                  ? () => {
                      if (!pickingId) void pickFileForProgram(f)
                    }
                  : undefined
              }
              onKeyDown={
                pickForProgramBlock
                  ? (e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !pickingId) {
                        e.preventDefault()
                        void pickFileForProgram(f)
                      }
                    }
                  : undefined
              }
            >
              {!pickForProgramBlock && !f.alreadyImported ? (
                <label className="flex items-center pt-1 shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(f.id)}
                    onChange={() => toggle(f.id)}
                    className="rounded border-[var(--color-border)]"
                  />
                </label>
              ) : !pickForProgramBlock ? (
                <span className="w-5 shrink-0" aria-hidden />
              ) : (
                <span className="w-5 shrink-0 flex items-center justify-center pt-1" aria-hidden>
                  {pickingId === f.id ? (
                    <span className="text-xs text-[var(--color-muted)]">…</span>
                  ) : null}
                </span>
              )}
              <div className="relative h-16 w-28 shrink-0 rounded bg-[var(--color-border)] overflow-hidden">
                {f.thumbnailLink ? (
                  <Image src={f.thumbnailLink} alt="" fill className="object-cover" sizes="112px" unoptimized />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-[var(--color-muted)] text-xs">No thumb</div>
                )}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium text-[var(--color-ink)] truncate">{f.name}</p>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">
                  {formatBytes(f.size)}
                  {f.durationSeconds != null ? ` · ${f.durationSeconds}s` : ''}
                  {' · '}
                  {formatWhen(f.modifiedTime)}
                </p>
                {f.alreadyImported && (
                  <span className="inline-block mt-1 rounded-full bg-[var(--color-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-muted)]">
                    Already imported
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!pickForProgramBlock && (
          <>
            <Button type="button" onClick={() => void importSelected()} disabled={importing || selectedToImport === 0}>
              {importing
                ? 'Importing…'
                : selectedToImport === 0
                  ? 'Import videos'
                  : `Import ${selectedToImport} video${selectedToImport === 1 ? '' : 's'}`}
            </Button>
            {selectableCount > 0 && (
              <Button
                type="button"
                variant="secondary"
                disabled={importing}
                onClick={() => {
                  const next = new Set(files.filter((f) => !f.alreadyImported).map((f) => f.id))
                  setSelected(next)
                }}
              >
                Select all new
              </Button>
            )}
          </>
        )}
        <Button type="button" variant="ghost" onClick={onClose} disabled={importing || !!pickingId}>
          Close
        </Button>
      </div>
    </Modal>
  )
}
