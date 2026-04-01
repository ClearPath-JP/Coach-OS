'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import type { CreateAssignmentTemplateInput } from '@/lib/validations'

const TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'video', label: 'Video' },
  { value: 'file', label: 'File' },
  { value: 'checklist', label: 'Checklist' },
] as const

export function CreateAssignmentTemplateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<CreateAssignmentTemplateInput>({
    title: '',
    instructions: '',
    assignmentType: 'text',
    checklistItems: [],
    dueDaysAfterAssign: 7,
    points: 10,
    programId: null,
    moduleId: null,
    isRequired: true,
    position: 0,
  })
  const [checkDraft, setCheckDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm({
      title: '',
      instructions: '',
      assignmentType: 'text',
      checklistItems: [],
      dueDaysAfterAssign: 7,
      points: 10,
      programId: null,
      moduleId: null,
      isRequired: true,
      position: 0,
    })
    setCheckDraft('')
  }, [open])

  const addChecklistItem = () => {
    const t = checkDraft.trim()
    if (!t) return
    setForm((f) => ({
      ...f,
      checklistItems: [...(f.checklistItems ?? []), t],
    }))
    setCheckDraft('')
  }

  const save = async () => {
    if (form.assignmentType === 'checklist') {
      const items = (form.checklistItems ?? []).map((s) => s.trim()).filter(Boolean)
      if (items.length === 0) {
        setError('Add at least one checklist item')
        return
      }
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/assignments/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          instructions: form.instructions || null,
          assignmentType: form.assignmentType,
          checklistItems: form.assignmentType === 'checklist' ? form.checklistItems : null,
          dueDaysAfterAssign: form.dueDaysAfterAssign,
          points: form.points,
          programId: form.programId,
          moduleId: form.moduleId,
          isRequired: form.isRequired,
          position: form.position,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not save')
        return
      }
      onCreated()
      onClose()
    } catch {
      setError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Create assignment template" className="w-full max-w-md">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Title *</label>
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Instructions</label>
          <Textarea
            rows={3}
            value={form.instructions ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Type</label>
          <select
            className="h-10 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3"
            value={form.assignmentType}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                assignmentType: e.target.value as CreateAssignmentTemplateInput['assignmentType'],
              }))
            }
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {form.assignmentType === 'checklist' ? (
          <div>
            <label className="mb-1 block text-sm font-medium">Checklist items</label>
            <div className="flex gap-2">
              <Input value={checkDraft} onChange={(e) => setCheckDraft(e.target.value)} placeholder="e.g. 10 pushups" />
              <Button type="button" variant="secondary" onClick={addChecklistItem}>
                Add
              </Button>
            </div>
            <ul className="mt-2 list-inside list-disc text-sm text-[var(--text-secondary)]">
              {(form.checklistItems ?? []).map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Points</label>
            <Input
              type="number"
              min={0}
              value={form.points}
              onChange={(e) => setForm((f) => ({ ...f, points: parseInt(e.target.value, 10) || 0 }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Due in (days)</label>
            <Input
              type="number"
              min={0}
              value={form.dueDaysAfterAssign}
              onChange={(e) => setForm((f) => ({ ...f, dueDaysAfterAssign: parseInt(e.target.value, 10) || 0 }))}
            />
          </div>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving || !form.title.trim()} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save template'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
