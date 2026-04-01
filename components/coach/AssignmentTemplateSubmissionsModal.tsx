'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export type AssignmentSubmissionRow = {
  id: string
  assignment_template_id: string
  status: string
  due_at: string | null
  submitted_at: string | null
  points_awarded: number
  client_id: string
  clients: { first_name: string | null; last_name: string | null } | null
  assignment_templates: { title: string; assignment_type: string; points: number } | null
}

function fullName(c: { first_name: string | null; last_name: string | null } | null) {
  return [c?.first_name, c?.last_name].filter(Boolean).join(' ') || 'Client'
}

type Props = {
  open: boolean
  onClose: () => void
  templateId: string | null
  templateTitle: string
  rows: AssignmentSubmissionRow[]
  onReview: (r: AssignmentSubmissionRow) => void
}

/**
 * Lists every client instance of a template: who submitted, who is still outstanding.
 */
export function AssignmentTemplateSubmissionsModal({
  open,
  onClose,
  templateId,
  templateTitle,
  rows,
  onReview,
}: Props) {
  const { submitted, awaiting } = useMemo(() => {
    if (!templateId) return { submitted: [] as AssignmentSubmissionRow[], awaiting: [] as AssignmentSubmissionRow[] }
    const forTpl = rows.filter((r) => r.assignment_template_id === templateId)
    const submitted = forTpl
      .filter((r) => r.submitted_at != null)
      .sort((a, b) => new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime())
    const awaiting = forTpl
      .filter((r) => r.submitted_at == null)
      .sort((a, b) => {
        const da = a.due_at ? new Date(a.due_at).getTime() : 0
        const db = b.due_at ? new Date(b.due_at).getTime() : 0
        return da - db
      })
    return { submitted, awaiting }
  }, [rows, templateId])

  if (!templateId) return null

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={templateTitle || 'Assignment'}
      className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-hidden"
    >
      <div className="flex max-h-[min(70vh,560px)] flex-col gap-6 overflow-y-auto pr-1">
        <p className="text-sm text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">{submitted.length}</span> submitted
          {awaiting.length > 0 ? (
            <>
              {' '}
              · <span className="font-medium text-[var(--text-primary)]">{awaiting.length}</span> still outstanding
            </>
          ) : null}
        </p>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            Submitted
          </h3>
          {submitted.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">No submissions yet for this assignment.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {submitted.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/coach/clients/${r.client_id}`}
                      className="font-medium text-[var(--accent)] hover:underline"
                    >
                      {fullName(r.clients)}
                    </Link>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {r.submitted_at
                        ? formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true })
                        : ''}
                      {r.status === 'approved' ? ' · Approved' : r.status === 'returned' ? ' · Returned for revision' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={r.status === 'approved' ? 'active' : 'pending'}>{r.status}</Badge>
                    {r.status === 'submitted' ? (
                      <Button type="button" size="sm" onClick={() => onReview(r)}>
                        Review
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {awaiting.length > 0 ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              Awaiting submission
            </h3>
            <ul className="mt-3 space-y-2">
              {awaiting.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2"
                >
                  <Link
                    href={`/coach/clients/${r.client_id}`}
                    className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline"
                  >
                    {fullName(r.clients)}
                  </Link>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {r.due_at
                      ? `Due ${formatDistanceToNow(new Date(r.due_at), { addSuffix: true })}`
                      : 'No due date'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Modal>
  )
}
