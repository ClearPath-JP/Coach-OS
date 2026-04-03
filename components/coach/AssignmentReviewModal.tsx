'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { VideoPlayer } from '@/components/ui/VideoPlayer'

export type AssignmentReviewModalProps = {
  open: boolean
  onClose: () => void
  clientAssignmentId: string
  clientName: string
  defaultPoints: number
  onReviewed?: () => void
}

type SubmissionRow = {
  id: string
  submission_type: string
  text_content: string | null
  video_id: string | null
  file_url: string | null
  checklist_responses: Record<string, boolean> | null
  version: number
  created_at: string
}

export function AssignmentReviewModal({
  open,
  onClose,
  clientAssignmentId,
  clientName,
  defaultPoints,
  onReviewed,
}: AssignmentReviewModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [feedback, setFeedback] = useState('')
  const [points, setPoints] = useState(defaultPoints)
  const [saving, setSaving] = useState(false)
  const maxPoints = Math.max(defaultPoints * 2, 0)

  useEffect(() => {
    if (!open) return
    setPoints(defaultPoints)
    setFeedback('')
    setError(null)
    setLoading(true)
    void (async () => {
      try {
        const res = await fetch(`/api/assignments/${clientAssignmentId}`)
        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? 'Could not load assignment')
          setLoading(false)
          return
        }
        const tpl = json.data?.assignment_templates as { title?: string } | null
        setTitle(tpl?.title ?? 'Assignment')
        setSubmissions((json.data?.submissions as SubmissionRow[]) ?? [])
      } catch {
        setError('Could not load assignment')
      } finally {
        setLoading(false)
      }
    })()
  }, [open, clientAssignmentId, defaultPoints])

  if (!open) return null

  const latest = submissions[0]

  const act = async (status: 'approved' | 'returned') => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/assignments/${clientAssignmentId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          coachFeedback: feedback.trim() || null,
          pointsAwarded: status === 'approved' ? Math.min(points, maxPoints) : 0,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Could not save review')
        return
      }
      onReviewed?.()
      onClose()
    } catch {
      setError('Something went wrong — try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-assignment-title"
    >
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close" />
      <div
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--cp-offwhite)] p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="review-assignment-title" className="text-lg font-medium text-[var(--text-primary)]">
          Review assignment
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {clientName} · {title}
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-[var(--text-tertiary)]">Loading submission…</p>
        ) : latest ? (
          <div className="mt-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 text-sm text-[var(--text-primary)]">
            <p className="text-xs text-[var(--text-tertiary)]">
              Submitted {new Date(latest.created_at).toLocaleString()} · v{latest.version}
            </p>
            {latest.submission_type === 'text' && latest.text_content ? (
              <p className="mt-2 whitespace-pre-wrap">{latest.text_content}</p>
            ) : null}
            {latest.submission_type === 'video' && latest.video_id ? (
              <div className="mt-3">
                <VideoPlayer videoId={latest.video_id} className="rounded-lg border border-[var(--border-default)]" />
              </div>
            ) : null}
            {latest.submission_type === 'file' && latest.file_url ? (
              <a href={latest.file_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[var(--cp-accent)]">
                Open attached file
              </a>
            ) : null}
            {latest.submission_type === 'checklist' && latest.checklist_responses ? (
              <ul className="mt-2 list-inside list-disc text-[var(--text-secondary)]">
                {Object.entries(latest.checklist_responses).map(([k, v]) => (
                  <li key={k}>
                    {k}: {v ? 'Done' : '—'}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--text-tertiary)]">No submission found.</p>
        )}

        <label className="mt-4 block text-sm font-medium text-[var(--text-primary)]">
          Add feedback for {clientName}
        </label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={4}
          placeholder="Great work! Here's what I noticed…"
          className="mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--cp-offwhite)] px-3 py-2 text-[15px]"
        />

        <div className="mt-4">
          <label className="text-sm font-medium text-[var(--text-primary)]">Points to award (max {maxPoints})</label>
          <Input
            type="number"
            min={0}
            max={maxPoints}
            value={points}
            onChange={(e) => setPoints(Number.parseInt(e.target.value, 10) || 0)}
            className="mt-1"
          />
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="border-amber-600/40 text-amber-800" onClick={() => void act('returned')} disabled={saving}>
            Return for revision
          </Button>
          <Button type="button" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => void act('approved')} disabled={saving || !latest}>
            {saving ? 'Saving…' : 'Approve'}
          </Button>
        </div>
      </div>
    </div>
  )
}
