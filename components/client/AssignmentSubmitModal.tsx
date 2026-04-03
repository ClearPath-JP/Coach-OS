'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { VideoPlayer } from '@/components/ui/VideoPlayer'
import { XP_ACTIONS } from '@/lib/xp-system'

const MAX_VIDEO_BYTES = 100 * 1024 * 1024

type AssignmentType = 'text' | 'video' | 'file' | 'checklist'

export type AssignmentSubmitModalProps = {
  open: boolean
  onClose: () => void
  clientAssignmentId: string
  title: string
  instructions: string | null
  assignmentType: AssignmentType
  checklistItems: string[] | null
  onSubmitted?: (payload: { xpAwarded: number; leveledUp: boolean; newLevelName?: string }) => void
}

export function AssignmentSubmitModal({
  open,
  onClose,
  clientAssignmentId,
  title,
  instructions,
  assignmentType,
  checklistItems,
  onSubmitted,
}: AssignmentSubmitModalProps) {
  const [textContent, setTextContent] = useState('')
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [videoFileSizeBytes, setVideoFileSizeBytes] = useState<number | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [celebrate, setCelebrate] = useState<{ levelName: string; totalXp: number } | null>(null)

  useEffect(() => {
    if (!open) return
    setTextContent('')
    setChecklist({})
    setUploadPct(null)
    setVideoId(null)
    setVideoFileSizeBytes(null)
    setFileUrl(null)
    setFileSizeBytes(null)
    setError(null)
    setCelebrate(null)
    const init: Record<string, boolean> = {}
    for (const item of checklistItems ?? []) init[item] = false
    setChecklist(init)
  }, [open, clientAssignmentId, checklistItems])

  const onPickVideo = async (file: File) => {
    setError(null)
    const mime = (file.type || '').toLowerCase().trim()
    if (!mime.startsWith('video/')) {
      setError('Choose a video file')
      return
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError('Video must be 100MB or smaller')
      return
    }
    setUploadPct(0)
    try {
      const fd = new FormData()
      fd.set('file', file)
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/client/videos/upload')
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100))
      }
      const p = new Promise<{ videoId: string; playbackUrl: string; fileSizeBytes: number }>((resolve, reject) => {
        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText) as {
              data?: { videoId?: string; playbackUrl?: string; fileSizeBytes?: number }
              error?: string
            }
            if (xhr.status >= 200 && xhr.status < 300 && json.data?.videoId) {
              resolve({
                videoId: json.data.videoId,
                playbackUrl: json.data.playbackUrl ?? '',
                fileSizeBytes: json.data.fileSizeBytes ?? 0,
              })
            } else {
              reject(new Error(json.error ?? 'Upload failed'))
            }
          } catch {
            reject(new Error('Upload failed'))
          }
        }
        xhr.onerror = () => reject(new Error('Network error'))
      })
      xhr.send(fd)
      const res = await p
      setVideoId(res.videoId)
      setVideoFileSizeBytes(res.fileSizeBytes > 0 ? res.fileSizeBytes : file.size)
      setUploadPct(100)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      setUploadPct(null)
    }
  }

  const onPickFile = async (file: File) => {
    setError(null)
    setUploadPct(0)
    try {
      const fd = new FormData()
      fd.set('kind', 'file')
      fd.set('file', file)
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/client/assignment-upload')
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100))
      }
      const p = new Promise<{ fileUrl: string; fileSizeBytes: number }>((resolve, reject) => {
        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText) as {
              data?: { fileUrl?: string; fileSizeBytes?: number }
              error?: string
            }
            if (xhr.status >= 200 && xhr.status < 300 && json.data?.fileUrl) {
              resolve({
                fileUrl: json.data.fileUrl,
                fileSizeBytes: json.data.fileSizeBytes ?? file.size,
              })
            } else {
              reject(new Error(json.error ?? 'Upload failed'))
            }
          } catch {
            reject(new Error('Upload failed'))
          }
        }
        xhr.onerror = () => reject(new Error('Network error'))
      })
      xhr.send(fd)
      const res = await p
      setFileUrl(res.fileUrl)
      setFileSizeBytes(res.fileSizeBytes)
      setUploadPct(100)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      setUploadPct(null)
    }
  }

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)
    try {
      let levelBefore = 1
      try {
        const pre = await fetch('/api/client/rewards', { cache: 'no-store' })
        const preJ = await pre.json().catch(() => ({}))
        levelBefore = typeof preJ.data?.level === 'number' ? preJ.data.level : 1
      } catch {
        levelBefore = 1
      }

      const body: Record<string, unknown> = { submissionType: assignmentType }
      if (assignmentType === 'text') body.textContent = textContent.trim()
      if (assignmentType === 'video') {
        body.videoId = videoId
        body.fileSizeBytes = videoFileSizeBytes
      }
      if (assignmentType === 'file') {
        body.fileUrl = fileUrl
        body.fileSizeBytes = fileSizeBytes
      }
      if (assignmentType === 'checklist') body.checklistResponses = checklist

      const res = await fetch(`/api/client/assignments/${clientAssignmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Could not submit')
        return
      }

      const xpAwarded = json.data?.xpAwarded ?? XP_ACTIONS.ASSIGNMENT_SUBMITTED

      const rewardsRes = await fetch('/api/client/rewards', { cache: 'no-store' })
      const rewardsJson = await rewardsRes.json().catch(() => ({}))
      const totalXp = rewardsJson.data?.totalXp as number | undefined
      const levelName = rewardsJson.data?.levelName as string | undefined
      const levelAfter = typeof rewardsJson.data?.level === 'number' ? rewardsJson.data.level : levelBefore
      const leveledUp = levelAfter > levelBefore

      const submittedPayload: { xpAwarded: number; leveledUp: boolean; newLevelName?: string } = {
        xpAwarded,
        leveledUp,
      }
      if (levelName !== undefined && levelName !== '') {
        submittedPayload.newLevelName = levelName
      }
      onSubmitted?.(submittedPayload)

      if (leveledUp && typeof totalXp === 'number' && levelName) {
        setCelebrate({ levelName, totalXp })
      } else {
        onClose()
      }
    } catch {
      setError('Something went wrong — try again')
    } finally {
      setLoading(false)
    }
  }

  const checklistDone = useCallback(() => {
    const items = checklistItems ?? []
    return items.length > 0 && items.every((i) => checklist[i] === true)
  }, [checklist, checklistItems])

  if (!open) return null

  const typeLabel =
    assignmentType === 'text'
      ? 'Text'
      : assignmentType === 'video'
        ? 'Video'
        : assignmentType === 'file'
          ? 'File'
          : 'Checklist'

  return (
    <>
      {celebrate ? (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[var(--cp-offwhite)] p-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={i}
                className="absolute h-2 w-2 animate-ping rounded-full bg-[var(--cp-accent)] opacity-60"
                style={{
                  left: `${(i * 37) % 100}%`,
                  top: `${(i * 23) % 100}%`,
                  animationDelay: `${i * 80}ms`,
                }}
              />
            ))}
          </div>
          <p className="text-2xl font-medium text-[var(--text-primary)]">Assignment submitted!</p>
          <p className="mt-2 text-[15px] text-[var(--text-secondary)]">
            +{XP_ACTIONS.ASSIGNMENT_SUBMITTED} XP · {celebrate.totalXp} XP total
          </p>
          <p className="mt-4 text-lg text-[var(--cp-accent)]">You are {celebrate.levelName}</p>
          <Button type="button" className="mt-8" onClick={() => { setCelebrate(null); onClose() }}>
            Keep going
          </Button>
        </div>
      ) : null}

      <div
        className="fixed inset-0 z-50 flex max-md:flex-col max-md:justify-end md:items-center md:justify-center md:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-assignment-title"
      >
        <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close" />
        <div
          className="relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-xl border border-[var(--border-default)] bg-[var(--cp-offwhite)] p-6 shadow-lg max-md:max-w-none md:max-w-lg md:rounded-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="submit-assignment-title" className="text-lg font-medium text-[var(--text-primary)]">
            {title}
          </h2>
          {instructions ? (
            <p className="mt-2 text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{instructions}</p>
          ) : null}
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">{typeLabel}</p>

          <div className="mt-4 space-y-4">
            {assignmentType === 'text' && (
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={6}
                placeholder="Describe what you did, how it went, any questions…"
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-3 py-2 text-[15px] text-[var(--text-primary)]"
              />
            )}
            {assignmentType === 'video' && (
              <div className="space-y-2">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void onPickVideo(f)
                    }}
                  />
                  Record or upload a video (max 100MB)
                </label>
                {uploadPct != null && (
                  <div className="space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border-default)]">
                      <div className="h-full bg-[var(--cp-accent)] transition-all" style={{ width: `${uploadPct}%` }} />
                    </div>
                    {uploadPct < 100 ? (
                      <p className="text-xs text-[var(--text-tertiary)]">Uploading… {uploadPct}%</p>
                    ) : null}
                  </div>
                )}
                {videoId ? (
                  <div className="mt-2">
                    <VideoPlayer videoId={videoId} title="Your recording" className="border border-[var(--border-default)]" />
                  </div>
                ) : null}
              </div>
            )}
            {assignmentType === 'file' && (
              <div>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-6 text-center text-sm text-[var(--text-secondary)]">
                  <input
                    type="file"
                    accept=".pdf,image/*,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void onPickFile(f)
                    }}
                  />
                  PDF, image, or document (max 10MB)
                </label>
                {uploadPct != null && uploadPct < 100 && (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--border-default)]">
                    <div className="h-full bg-[var(--cp-accent)] transition-all" style={{ width: `${uploadPct}%` }} />
                  </div>
                )}
                {fileUrl ? <p className="mt-2 text-xs text-[var(--text-tertiary)]">File attached</p> : null}
              </div>
            )}
            {assignmentType === 'checklist' && (
              <ul className="space-y-2">
                {(checklistItems ?? []).map((item) => (
                  <li key={item}>
                    <label className="flex items-center gap-2 text-[15px] text-[var(--text-primary)]">
                      <input
                        type="checkbox"
                        checked={checklist[item] ?? false}
                        onChange={(e) => setChecklist((c) => ({ ...c, [item]: e.target.checked }))}
                        className="size-4 rounded border-[var(--border-default)]"
                      />
                      {item}
                    </label>
                  </li>
                ))}
                <p className="text-xs text-[var(--text-tertiary)]">
                  {(checklistItems ?? []).filter((i) => checklist[i]).length} of {(checklistItems ?? []).length}{' '}
                  complete
                </p>
              </ul>
            )}
          </div>

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                loading ||
                (assignmentType === 'text' && textContent.trim().length < 20) ||
                (assignmentType === 'video' && !videoId) ||
                (assignmentType === 'file' && !fileUrl) ||
                (assignmentType === 'checklist' && !checklistDone())
              }
              onClick={() => void handleSubmit()}
            >
              {loading ? 'Submitting…' : `Submit assignment (+${XP_ACTIONS.ASSIGNMENT_SUBMITTED} XP)`}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
