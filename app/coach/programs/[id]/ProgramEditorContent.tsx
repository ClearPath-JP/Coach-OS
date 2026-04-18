'use client'

import { useEffect, useState, useCallback, useRef, useSyncExternalStore } from 'react'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { AssignProgramModal } from '@/components/coach/AssignProgramModal'
import { VideoSelectModal, type VideoOption } from '@/components/coach/VideoSelectModal'
import { DriveFileBrowser } from '@/components/coach/DriveFileBrowser'
import { cn } from '@/lib/utils'

/* ─── Types ─── */

type ProgramModule = {
  id: string
  program_id: string
  title: string
  description: string | null
  position: number
  created_at: string
  updated_at: string
  content?: ProgramContent[]
}

type ProgramContent = {
  id: string
  module_id: string
  content_type: 'text' | 'url' | 'video' | 'file'
  title: string | null
  body: string | null
  url: string | null
  video_id: string | null
  file_url: string | null
  position: number
  created_at: string
  updated_at: string
}

type ProgramData = {
  id: string
  workspace_id: string
  coach_id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  status: string
  total_modules: number
  created_at: string
  updated_at: string
  modules: ProgramModule[]
}

/* ─── Inline SVG Icons ─── */

function GripIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="5" cy="3" r="1.25" />
      <circle cx="11" cy="3" r="1.25" />
      <circle cx="5" cy="8" r="1.25" />
      <circle cx="11" cy="8" r="1.25" />
      <circle cx="5" cy="13" r="1.25" />
      <circle cx="11" cy="13" r="1.25" />
    </svg>
  )
}

function FilmIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
      <line x1="17" y1="17" x2="22" y2="17" />
    </svg>
  )
}

function TextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="17" y1="10" x2="3" y2="10" />
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="21" y1="14" x2="3" y2="14" />
      <line x1="17" y1="18" x2="3" y2="18" />
    </svg>
  )
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function PlayCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

/* ─── Content type icon resolver ─── */

function ContentTypeIcon({ type, className }: { type: string; className?: string }) {
  const cls = className ?? ''
  switch (type) {
    case 'video':
      return <FilmIcon className={cls} />
    case 'text':
      return <TextIcon className={cls} />
    case 'url':
      return <LinkIcon className={cls} />
    case 'file':
      return <PaperclipIcon className={cls} />
    default:
      return <TextIcon className={cls} />
  }
}

/* ─── ModuleRow (sortable) ─── */

function ModuleRow({
  module,
  isSelected,
  onSelect,
  onDelete,
  isDragDisabled,
}: {
  module: ProgramModule
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  isDragDisabled?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: module.id,
    disabled: isDragDisabled ?? false,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const contentCount = module.content?.length ?? 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer',
        'transition-all duration-150',
        isSelected
          ? 'bg-[var(--color-accent)]/10 ring-1 ring-[var(--color-accent)]/40'
          : 'hover:bg-[var(--bg-subtle)]',
        isDragging && 'opacity-40 shadow-lg scale-[1.02]'
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className={cn(
          'touch-none flex h-8 w-6 shrink-0 items-center justify-center rounded',
          'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
          'transition-colors duration-150',
          isDragDisabled ? 'cursor-default opacity-30' : 'cursor-grab active:cursor-grabbing'
        )}
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
        {...(isDragDisabled ? {} : { ...attributes, ...listeners })}
      >
        <GripIcon />
      </button>

      {/* Module info */}
      <div className="min-w-0 flex-1">
        <p className={cn(
          'truncate text-sm font-medium leading-snug',
          isSelected ? 'text-[var(--color-accent)]' : 'text-[var(--text-primary)]'
        )}>
          {module.title || 'Untitled module'}
        </p>
      </div>

      {/* Content count badge */}
      <span className={cn(
        'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5',
        'text-[11px] font-medium tabular-nums',
        isSelected
          ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
          : 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]'
      )}>
        {contentCount}
      </span>

      {/* Delete button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
          'text-[var(--text-tertiary)] transition-all duration-150',
          'opacity-0 group-hover:opacity-100 focus:opacity-100',
          'hover:bg-[var(--error)]/10 hover:text-[var(--error)]',
          'lg:opacity-0 lg:group-hover:opacity-100'
        )}
        aria-label="Delete module"
      >
        <TrashIcon />
      </button>
    </div>
  )
}

/* ─── Main Editor ─── */

export function ProgramEditorContent({ programId }: { programId: string }) {
  const [program, setProgram] = useState<ProgramData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [savingTitle, setSavingTitle] = useState(false)
  const [savingDesc, setSavingDesc] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [addModuleOpen, setAddModuleOpen] = useState(false)
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [newModuleDesc, setNewModuleDesc] = useState('')
  const [addingModule, setAddingModule] = useState(false)
  const [editingContentId, setEditingContentId] = useState<string | null>(null)
  const [addContentOpen, setAddContentOpen] = useState(false)
  const isLgUp = useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia('(min-width: 1024px)')
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia('(min-width: 1024px)').matches,
    () => false
  )
  const selectedModuleIdRef = useRef(selectedModuleId)
  selectedModuleIdRef.current = selectedModuleId

  /* ─── Data fetching ─── */

  const fetchProgram = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/programs/${programId}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load program')
        setProgram(null)
        return
      }
      const data = json.data as ProgramData
      setProgram(data)
      setTitle(data.title)
      setDescription(data.description ?? '')
      setStatus(data.status === 'published' ? 'published' : 'draft')
      const firstModule = data.modules?.[0]
      if (data.modules?.length && !selectedModuleIdRef.current && firstModule) {
        setSelectedModuleId(firstModule.id)
      }
    } catch {
      setError('Something went wrong — check your connection and try again')
      setProgram(null)
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    fetchProgram()
  }, [fetchProgram])

  const selectedModule = program?.modules?.find((m) => m.id === selectedModuleId)

  /* ─── Handlers ─── */

  const handleModuleSelect = (id: string) => {
    if (isLgUp) {
      setSelectedModuleId(id)
    } else {
      setSelectedModuleId((prev) => (prev === id ? null : id))
    }
  }

  const saveTitle = async () => {
    if (!program || title.trim() === program.title) return
    setSavingTitle(true)
    try {
      const res = await fetch(`/api/programs/${programId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      })
      if (res.ok) {
        setProgram((p) => (p ? { ...p, title: title.trim() } : null))
      }
    } finally {
      setSavingTitle(false)
    }
  }

  const saveDescription = async () => {
    if (!program || description === (program.description ?? '')) return
    setSavingDesc(true)
    try {
      const res = await fetch(`/api/programs/${programId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() || null }),
      })
      if (res.ok) {
        setProgram((p) => (p ? { ...p, description: description.trim() || null } : null))
      }
    } finally {
      setSavingDesc(false)
    }
  }

  const toggleStatus = async () => {
    if (!program) return
    const next = status === 'draft' ? 'published' : 'draft'
    setSavingStatus(true)
    try {
      const res = await fetch(`/api/programs/${programId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (res.ok) {
        setStatus(next)
        setProgram((p) => (p ? { ...p, status: next } : null))
      }
    } finally {
      setSavingStatus(false)
    }
  }

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newModuleTitle.trim()) return
    setAddingModule(true)
    try {
      const res = await fetch(`/api/programs/${programId}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newModuleTitle.trim(),
          description: newModuleDesc.trim() || null,
        }),
      })
      const json = await res.json()
      if (res.ok && json.data) {
        setAddModuleOpen(false)
        setNewModuleTitle('')
        setNewModuleDesc('')
        setProgram((p) => {
          if (!p) return null
          const mods = [...(p.modules || []), { ...json.data, content: [] }]
          mods.sort((a, b) => a.position - b.position)
          return { ...p, modules: mods, total_modules: mods.length }
        })
        setSelectedModuleId(json.data.id)
      }
    } finally {
      setAddingModule(false)
    }
  }

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Delete this module and all its content?')) return
    try {
      const res = await fetch(`/api/programs/${programId}/modules/${moduleId}`, { method: 'DELETE' })
      if (res.ok) {
        setProgram((p) => {
          if (!p) return null
          const mods = (p.modules || []).filter((m) => m.id !== moduleId)
          if (selectedModuleId === moduleId) setSelectedModuleId(mods[0]?.id ?? null)
          return { ...p, modules: mods, total_modules: mods.length }
        })
      }
    } catch {
      // ignore
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !program?.modules) return
    const oldIndex = program.modules.findIndex((m) => m.id === active.id)
    const newIndex = program.modules.findIndex((m) => m.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(program.modules, oldIndex, newIndex)
    setProgram((p) => (p ? { ...p, modules: reordered } : null))
    const moved = reordered[newIndex]
    if (!moved) return
    const moduleId = moved.id
    try {
      await fetch(`/api/programs/${programId}/modules/${moduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: newIndex }),
      })
    } catch {
      fetchProgram()
    }
  }

  /* ─── Loading state ─── */

  if (loading) {
    return (
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full lg:w-[380px] space-y-4">
          <div className="animate-pulse rounded-xl bg-[var(--bg-subtle)] h-40" />
          <div className="animate-pulse rounded-xl bg-[var(--bg-subtle)] h-10" />
          <div className="animate-pulse rounded-xl bg-[var(--bg-subtle)] h-48" />
        </div>
        <div className="flex-1">
          <div className="animate-pulse rounded-xl bg-[var(--bg-subtle)] h-96" />
        </div>
      </div>
    )
  }

  /* ─── Error state ─── */

  if (error || !program) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] px-6 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--error)]/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <p className="text-sm text-[var(--text-tertiary)] max-w-sm">{error ?? 'Program not found'}</p>
        <Link href="/coach/programs">
          <Button variant="secondary" className="mt-6">
            <ChevronLeftIcon className="mr-1.5" />
            Back to programs
          </Button>
        </Link>
      </div>
    )
  }

  const moduleCount = program.modules?.length ?? 0
  const totalContent = (program.modules ?? []).reduce((sum, m) => sum + (m.content?.length ?? 0), 0)
  const hasTitle = title.trim().length > 0
  const hasModules = moduleCount > 0
  const hasContent = totalContent > 0
  const isPublished = status === 'published'

  // Flow step calculation
  const currentStep = !hasTitle ? 0 : !hasModules ? 1 : !hasContent ? 2 : !isPublished ? 3 : 4
  const steps = [
    { label: 'Details', done: hasTitle },
    { label: 'Modules', done: hasModules },
    { label: 'Content', done: hasContent },
    { label: 'Publish', done: isPublished },
  ]

  /* ─── Main layout ─── */

  return (
    <div className="relative flex flex-col gap-0 pb-24 lg:pb-20">
      {/* ────────── TOP FLOW BAR ────────── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/coach/programs"
            className="flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeftIcon className="size-4" />
            Programs
          </Link>
          <span className="text-[var(--border-default)]">/</span>
          <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">
            {title || 'Untitled program'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Step indicators */}
          <div className="hidden items-center gap-1 sm:flex">
            {steps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-1">
                {i > 0 && <div className={`h-px w-4 ${i <= currentStep ? 'bg-[var(--color-accent)]' : 'bg-[var(--border-default)]'}`} />}
                <div className="flex items-center gap-1.5">
                  <div className={`flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    step.done ? 'bg-[var(--color-accent)] text-white' :
                    i === currentStep ? 'border-2 border-[var(--color-accent)] text-[var(--color-accent)]' :
                    'border border-[var(--border-default)] text-[var(--text-tertiary)]'
                  }`}>
                    {step.done ? (
                      <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : i + 1}
                  </div>
                  <span className={`text-[11px] font-medium ${i <= currentStep ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                    {step.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {/* Primary action button */}
          {!isPublished ? (
            <Button
              size="sm"
              className="h-8"
              disabled={!hasTitle || !hasModules || !hasContent || savingStatus}
              onClick={toggleStatus}
            >
              {savingStatus ? 'Publishing...' : 'Publish'}
            </Button>
          ) : (
            <Button size="sm" className="h-8" onClick={() => setAssignOpen(true)}>
              <UsersIcon className="mr-1" />
              Assign to clients
            </Button>
          )}
        </div>
      </div>

      {/* ────────── EDITOR BODY ────────── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* ────────── LEFT PANEL ────────── */}
      <div className="flex w-full shrink-0 flex-col gap-5 lg:w-[380px] lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1">

        {/* Thumbnail / gradient placeholder */}
        <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: '16 / 9' }}>
          {program.thumbnail_url ? (
            <img
              src={program.thumbnail_url}
              alt={program.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent) 0%, color-mix(in srgb, var(--color-accent) 40%, var(--bg-app)) 100%)',
              }}
            >
              <div className="flex h-full w-full items-center justify-center">
                <PlayCircleIcon className="h-10 w-10 text-white/60" />
              </div>
            </div>
          )}
        </div>

        {/* Title input */}
        <div>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            disabled={savingTitle}
            placeholder="Program title"
            inputSize="lg"
            className="text-base font-semibold"
          />
        </div>

        {/* Description textarea */}
        <div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            disabled={savingDesc}
            placeholder="Add a description..."
            rows={2}
          />
        </div>

        {/* Status toggle + Assign button row */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleStatus}
            disabled={savingStatus}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold uppercase tracking-wide',
              'transition-all duration-150 disabled:opacity-50',
              status === 'published'
                ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                : 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]'
            )}
          >
            <span className={cn(
              'h-1.5 w-1.5 rounded-full',
              status === 'published' ? 'bg-[var(--color-success)]' : 'bg-[var(--text-tertiary)]'
            )} />
            {status === 'draft' ? 'Draft' : 'Published'}
          </button>

          <button
            type="button"
            onClick={() => setAssignOpen(true)}
            className={cn(
              'ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-3',
              'border border-[var(--border-default)] bg-transparent',
              'text-xs font-medium text-[var(--text-secondary)]',
              'transition-all duration-150',
              'hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
            )}
          >
            <UsersIcon />
            Assign to client
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-[var(--border-default)]" />

        {/* Module list header */}
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Modules
            {moduleCount > 0 && (
              <span className="ml-1.5 text-[var(--text-tertiary)]/60">({moduleCount})</span>
            )}
          </h3>
          <button
            type="button"
            onClick={() => setAddModuleOpen(true)}
            className={cn(
              'hidden lg:inline-flex h-7 items-center gap-1 rounded-md px-2',
              'text-xs font-medium text-[var(--color-accent)]',
              'transition-colors duration-150',
              'hover:bg-[var(--color-accent)]/10'
            )}
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add
          </button>
        </div>

        {/* Module list with drag-and-drop */}
        <div className="flex flex-col gap-1">
          {moduleCount === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-default)] py-10 text-center">
              <p className="text-sm text-[var(--text-tertiary)]">No modules yet</p>
              <button
                type="button"
                onClick={() => setAddModuleOpen(true)}
                className="mt-2 text-sm font-medium text-[var(--color-accent)] hover:underline"
              >
                Add your first module
              </button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={(program.modules || []).map((m) => m.id)}
                strategy={verticalListSortingStrategy}
              >
                {(program.modules || []).map((mod) => (
                  <div key={mod.id}>
                    <ModuleRow
                      module={mod}
                      isSelected={selectedModuleId === mod.id}
                      onSelect={() => handleModuleSelect(mod.id)}
                      onDelete={() => handleDeleteModule(mod.id)}
                      isDragDisabled={!isLgUp}
                    />

                    {/* Mobile inline editor: shows below selected module */}
                    {!isLgUp && selectedModuleId === mod.id && selectedModule?.id === mod.id && (
                      <div className="mt-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
                        <ProgramModuleEditor
                          programId={programId}
                          workspaceId={program.workspace_id}
                          module={selectedModule}
                          onUpdate={(updated) => {
                            setProgram((p) =>
                              p
                                ? {
                                    ...p,
                                    modules:
                                      p.modules?.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)) ?? [],
                                  }
                                : null
                            )
                          }}
                          onRefresh={fetchProgram}
                          editingContentId={editingContentId}
                          setEditingContentId={setEditingContentId}
                          addContentOpen={addContentOpen}
                          setAddContentOpen={setAddContentOpen}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* ────────── RIGHT PANEL (desktop only) ────────── */}
      <div className="hidden min-w-0 flex-1 lg:block">
        {!selectedModule ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] px-8 py-20 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-muted)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Select a module to start editing
            </p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Choose from the list on the left, or add a new module
            </p>
          </div>
        ) : (
          <ProgramModuleEditor
            programId={programId}
            workspaceId={program.workspace_id}
            module={selectedModule}
            onUpdate={(updated) => {
              setProgram((p) =>
                p
                  ? {
                      ...p,
                      modules: p.modules?.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)) ?? [],
                    }
                  : null
              )
            }}
            onRefresh={fetchProgram}
            editingContentId={editingContentId}
            setEditingContentId={setEditingContentId}
            addContentOpen={addContentOpen}
            setAddContentOpen={setAddContentOpen}
          />
        )}
      </div>

      {/* ────────── Mobile bottom bar: Add module ────────── */}
      <div className="safe-bottom fixed bottom-16 left-0 right-0 z-30 border-t border-[var(--border-default)] bg-[var(--bg-app)] px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setAddModuleOpen(true)}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg',
            'border border-dashed border-[var(--border-default)]',
            'h-11 text-sm font-medium text-[var(--text-tertiary)]',
            'transition-colors duration-150',
            'hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
          )}
        >
          <PlusIcon className="h-4 w-4" />
          Add module
        </button>
      </div>

      {/* ────────── Add module modal ────────── */}
      <Modal
        isOpen={addModuleOpen}
        onClose={() => setAddModuleOpen(false)}
        title="Add module"
        className="w-full max-w-none md:max-w-md"
      >
        <form onSubmit={handleAddModule} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Title <span className="text-[var(--error)]">*</span>
            </label>
            <Input
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              placeholder="e.g. Week 1 — Fundamentals"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Description
            </label>
            <Textarea
              value={newModuleDesc}
              onChange={(e) => setNewModuleDesc(e.target.value)}
              placeholder="Optional module description"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAddModuleOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addingModule}>
              {addingModule ? 'Adding...' : 'Add module'}
            </Button>
          </div>
        </form>
      </Modal>

      </div>{/* end EDITOR BODY */}

      {/* ────────── BOTTOM ACTION BAR ────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border-default)] bg-[var(--bg-app)]/95 backdrop-blur-sm lg:bottom-0">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-[13px] text-[var(--text-tertiary)]">
            <span>{moduleCount} {moduleCount === 1 ? 'module' : 'modules'}</span>
            <span aria-hidden>·</span>
            <span>{totalContent} {totalContent === 1 ? 'item' : 'items'}</span>
            {isPublished && (
              <>
                <span aria-hidden>·</span>
                <span className="flex items-center gap-1 text-[var(--color-success)]">
                  <span className="size-1.5 rounded-full bg-[var(--color-success)]" />
                  Published
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isPublished && hasModules && hasContent && (
              <Button size="sm" className="h-9" disabled={savingStatus} onClick={toggleStatus}>
                Publish program
              </Button>
            )}
            {!isPublished && (!hasModules || !hasContent) && (
              <Button
                size="sm"
                variant="secondary"
                className="h-9"
                onClick={() => {
                  if (!hasModules) setAddModuleOpen(true)
                  else if (selectedModule && !hasContent) setAddContentOpen(true)
                }}
              >
                {!hasModules ? 'Add first module' : 'Add content'}
              </Button>
            )}
            {isPublished && (
              <>
                <Button size="sm" variant="secondary" className="h-9" onClick={toggleStatus} disabled={savingStatus}>
                  Unpublish
                </Button>
                <Button size="sm" className="h-9" onClick={() => setAssignOpen(true)}>
                  Assign to clients
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ────────── Assign modal ────────── */}
      <AssignProgramModal
        programId={programId}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onAssigned={() => {
          setAssignOpen(false)
          fetchProgram()
        }}
      />
    </div>
  )
}

/* ─── Module Detail Editor (right panel / inline mobile) ─── */

function ProgramModuleEditor({
  programId,
  workspaceId,
  module,
  onUpdate,
  onRefresh,
  editingContentId,
  setEditingContentId,
  addContentOpen,
  setAddContentOpen,
}: {
  programId: string
  workspaceId: string
  module: ProgramModule
  onUpdate: (m: Partial<ProgramModule>) => void
  onRefresh: () => void
  editingContentId: string | null
  setEditingContentId: (id: string | null) => void
  addContentOpen: boolean
  setAddContentOpen: (v: boolean) => void
}) {
  const [moduleTitle, setModuleTitle] = useState(module.title)
  const [moduleDesc, setModuleDesc] = useState(module.description ?? '')
  const [savingMod, setSavingMod] = useState(false)

  useEffect(() => {
    setModuleTitle(module.title)
    setModuleDesc(module.description ?? '')
  }, [module.id, module.title, module.description])

  const saveModuleTitle = async () => {
    if (moduleTitle.trim() === module.title) return
    setSavingMod(true)
    try {
      const res = await fetch(`/api/programs/${programId}/modules/${module.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: moduleTitle.trim() }),
      })
      if (res.ok) onUpdate({ title: moduleTitle.trim() })
    } finally {
      setSavingMod(false)
    }
  }

  const saveModuleDesc = async () => {
    if ((moduleDesc || '') === (module.description ?? '')) return
    setSavingMod(true)
    try {
      const res = await fetch(`/api/programs/${programId}/modules/${module.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: moduleDesc.trim() || null }),
      })
      if (res.ok) onUpdate({ description: moduleDesc.trim() || null })
    } finally {
      setSavingMod(false)
    }
  }

  const addContent = async (contentType: 'text' | 'url' | 'video' | 'file') => {
    try {
      const res = await fetch(
        `/api/programs/${programId}/modules/${module.id}/content`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentType }),
        }
      )
      const json = await res.json()
      if (res.ok && json.data) {
        onRefresh()
        setEditingContentId(json.data.id)
      }
    } catch {
      // ignore
    }
    setAddContentOpen(false)
  }

  const deleteContent = async (contentId: string) => {
    if (!confirm('Delete this content block?')) return
    try {
      const res = await fetch(`/api/content/${contentId}`, { method: 'DELETE' })
      if (res.ok) onRefresh()
    } catch {
      // ignore
    }
    setEditingContentId(null)
  }

  const contentBlocks = (module.content ?? []).sort((a, b) => a.position - b.position)

  const contentTypeOptions: { type: 'text' | 'url' | 'video' | 'file'; label: string; desc: string }[] = [
    { type: 'text', label: 'Text / Notes', desc: 'Written instructions or notes' },
    { type: 'url', label: 'URL Link', desc: 'Link to an external resource' },
    { type: 'video', label: 'Video', desc: 'From your library or Drive' },
    { type: 'file', label: 'File', desc: 'Upload a document or image' },
  ]

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]">
      {/* Module header */}
      <div className="border-b border-[var(--border-default)] p-5">
        <Input
          value={moduleTitle}
          onChange={(e) => setModuleTitle(e.target.value)}
          onBlur={saveModuleTitle}
          disabled={savingMod}
          placeholder="Module title"
          inputSize="lg"
          className="text-base font-semibold"
        />
        <div className="mt-3">
          <Textarea
            value={moduleDesc}
            onChange={(e) => setModuleDesc(e.target.value)}
            onBlur={saveModuleDesc}
            disabled={savingMod}
            placeholder="Module description (optional)"
            rows={2}
          />
        </div>
      </div>

      {/* Content blocks */}
      <div className="p-5">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          Content
          {contentBlocks.length > 0 && (
            <span className="ml-1.5 normal-case tracking-normal font-normal">
              ({contentBlocks.length} item{contentBlocks.length !== 1 ? 's' : ''})
            </span>
          )}
        </h4>

        {contentBlocks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border-default)] py-8 text-center">
            <p className="text-sm text-[var(--text-tertiary)]">No content yet</p>
            <p className="mt-0.5 text-xs text-[var(--text-tertiary)]/60">
              Add videos, notes, links, or files below
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {contentBlocks.map((block) => (
              <ContentBlockRow
                key={block.id}
                block={block}
                isEditing={editingContentId === block.id}
                onEdit={() => setEditingContentId(block.id)}
                onDelete={() => deleteContent(block.id)}
                onCloseEditor={() => setEditingContentId(null)}
                onSaved={() => {
                  onRefresh()
                  setEditingContentId(null)
                }}
                onRefreshProgram={onRefresh}
                workspaceId={workspaceId}
              />
            ))}
          </div>
        )}

        {/* Add content button + dropdown */}
        <div className="relative mt-4">
          <button
            type="button"
            onClick={() => setAddContentOpen(!addContentOpen)}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5',
              'text-sm font-medium',
              'bg-[var(--color-accent)] text-white',
              'transition-all duration-150',
              'hover:bg-[var(--color-accent-hover)]',
              'active:scale-[0.98]'
            )}
          >
            <PlusIcon className="h-4 w-4" />
            Add content
          </button>

          {addContentOpen && (
            <div className="absolute top-full left-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-app)] p-1.5 shadow-lg">
              {contentTypeOptions.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => addContent(opt.type)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left',
                    'transition-colors duration-100',
                    'hover:bg-[var(--bg-subtle)]'
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)] text-[var(--text-tertiary)]">
                    <ContentTypeIcon type={opt.type} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{opt.label}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Content Block Row ─── */

function ContentBlockRow({
  block,
  isEditing,
  onEdit,
  onDelete,
  onCloseEditor,
  onSaved,
  onRefreshProgram,
  workspaceId,
}: {
  block: ProgramContent
  isEditing: boolean
  onEdit: () => void
  onDelete: () => void
  onCloseEditor: () => void
  onSaved: () => void
  onRefreshProgram: () => void
  workspaceId: string
}) {
  const label = block.title
    || (block.body ? block.body.slice(0, 60) + (block.body.length > 60 ? '...' : '') : null)
    || (block.url ? block.url.replace(/^https?:\/\//, '').slice(0, 50) : null)
    || (block.file_url ? block.file_url.split('/').pop()?.slice(0, 40) : null)
    || 'Untitled'

  const typeLabel = block.content_type === 'text' ? 'Text'
    : block.content_type === 'url' ? 'Link'
    : block.content_type === 'video' ? 'Video'
    : 'File'

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] transition-shadow duration-150 hover:shadow-sm">
      {/* Compact row */}
      <div className="group flex items-center gap-3 px-3.5 py-2.5">
        {/* Type icon */}
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)] text-[var(--text-tertiary)]">
          <ContentTypeIcon type={block.content_type} />
        </span>

        {/* Title + type label */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--text-primary)]">{label}</p>
          <p className="text-xs text-[var(--text-tertiary)]">{typeLabel}</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md',
              'text-[var(--text-tertiary)] transition-colors duration-150',
              'hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]'
            )}
            aria-label="Edit content"
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md',
              'text-[var(--text-tertiary)] transition-colors duration-150',
              'hover:bg-[var(--error)]/10 hover:text-[var(--error)]'
            )}
            aria-label="Delete content"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Expanded editor */}
      {isEditing && (
        <div className="border-t border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
          <ContentBlockEditor
            block={block}
            onClose={onCloseEditor}
            onSaved={onSaved}
            onRefreshProgram={onRefreshProgram}
            workspaceId={workspaceId}
          />
        </div>
      )}
    </div>
  )
}

/* ─── Video Block Editor ─── */

function VideoBlockEditor({
  block,
  onClose,
  onSaved,
  onRefreshProgram,
}: {
  block: ProgramContent
  onClose: () => void
  onSaved: () => void
  onRefreshProgram: () => void
}) {
  const [videoSelectOpen, setVideoSelectOpen] = useState(false)
  const [driveOpen, setDriveOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [driveSuccess, setDriveSuccess] = useState<string | null>(null)
  const [driveLinkError, setDriveLinkError] = useState<string | null>(null)

  const handleSelectVideo = async (video: VideoOption) => {
    const hasSource = Boolean(video.drive_file_id?.trim()) || Boolean(video.playback_url?.trim())
    if (!hasSource) return
    setSaving(true)
    try {
      const res = await fetch(`/api/content/${block.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          url: video.playback_url?.trim() || null,
          title: video.title,
        }),
      })
      if (res.ok) onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-tertiary)]">
        Link a video from your library or browse Google Drive.
      </p>

      {/* Currently linked video preview */}
      {block.video_id && (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] p-3">
          <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)] overflow-hidden">
            <PlayCircleIcon className="text-[var(--text-tertiary)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">
              {block.title || 'Video'}
            </p>
            <p className="text-xs text-[var(--color-success)]">Linked</p>
          </div>
        </div>
      )}

      {driveLinkError && (
        <p className="text-xs text-[var(--error)]" role="alert">{driveLinkError}</p>
      )}
      {driveSuccess && (
        <p className="text-xs font-medium text-[var(--color-success)]" role="status">{driveSuccess}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setDriveSuccess(null)
            setVideoSelectOpen(true)
          }}
          disabled={saving}
        >
          {block.video_id ? 'Change video' : 'Select from library'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setDriveSuccess(null)
            setDriveLinkError(null)
            setDriveOpen(true)
          }}
          disabled={saving}
        >
          Browse Drive
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>

      <VideoSelectModal
        open={videoSelectOpen}
        onClose={() => setVideoSelectOpen(false)}
        onSelect={handleSelectVideo}
      />
      <DriveFileBrowser
        open={driveOpen}
        onClose={() => setDriveOpen(false)}
        pickForProgramBlock
        onProgramBlockPicked={async ({ videoId, title: rawName }) => {
          setSaving(true)
          setDriveSuccess(null)
          setDriveLinkError(null)
          try {
            const displayTitle =
              rawName.trim().replace(/\.(mp4|mov|webm|mkv|avi|m4v)$/i, '') || 'Video'
            const res = await fetch(`/api/content/${block.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                videoId,
                title: displayTitle,
                url: null,
              }),
            })
            if (!res.ok) {
              const j = (await res.json().catch(() => ({}))) as { error?: string }
              setDriveLinkError(j.error ?? 'Could not add video to this module')
              return
            }
            setDriveOpen(false)
            setDriveSuccess('Imported and linked successfully')
            onRefreshProgram()
          } finally {
            setSaving(false)
          }
        }}
      />
    </div>
  )
}

/* ─── Content Block Editor ─── */

function ContentBlockEditor({
  block,
  onClose,
  onSaved,
  onRefreshProgram,
  workspaceId,
}: {
  block: ProgramContent
  onClose: () => void
  onSaved: () => void
  onRefreshProgram: () => void
  workspaceId: string
}) {
  const [title, setTitle] = useState(block.title ?? '')
  const [body, setBody] = useState(block.body ?? '')
  const [url, setUrl] = useState(block.url ?? '')
  const [fileUrl, setFileUrl] = useState(block.file_url ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/content/${block.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          block.content_type === 'text'
            ? { title: title || null, body: body || null }
            : block.content_type === 'url'
              ? { title: title || null, url: url || null }
              : block.content_type === 'file'
                ? { title: title || null, fileUrl: fileUrl || null }
                : {}
        ),
      })
      if (res.ok) onSaved()
    } finally {
      setSaving(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('type', 'program-file')
      form.set('moduleId', block.module_id)
      form.set('workspaceId', workspaceId)
      const res = await fetch('/api/upload', { method: 'POST', body: form, credentials: 'include' })
      const json = await res.json()
      const nextUrl = json.data?.url ?? json.data?.fileUrl
      if (res.ok && nextUrl) setFileUrl(nextUrl)
    } finally {
      setUploading(false)
    }
  }

  if (block.content_type === 'video') {
    return (
      <VideoBlockEditor
        block={block}
        onClose={onClose}
        onSaved={onSaved}
        onRefreshProgram={onRefreshProgram}
      />
    )
  }

  return (
    <div className="space-y-3">
      {/* Title field */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional title" />
      </div>

      {/* Text body */}
      {block.content_type === 'text' && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Body</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Write your content here..."
          />
        </div>
      )}

      {/* URL field */}
      {block.content_type === 'url' && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">URL</label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            type="url"
          />
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--color-accent)] hover:underline"
            >
              <LinkIcon className="h-3 w-3" />
              {url.replace(/^https?:\/\//, '').slice(0, 50)}
            </a>
          )}
        </div>
      )}

      {/* File upload */}
      {block.content_type === 'file' && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">File</label>
          <div className="rounded-lg border border-dashed border-[var(--border-default)] p-4">
            <input
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full text-sm text-[var(--text-primary)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--bg-muted)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[var(--text-secondary)]"
            />
          </div>
          {fileUrl && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
              <PaperclipIcon className="h-3 w-3" />
              {fileUrl.split('/').pop()?.slice(0, 50) || 'File uploaded'}
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
