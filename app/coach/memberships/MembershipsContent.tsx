'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  Users,
  AlertTriangle,
} from 'lucide-react'
import { formatCents } from '@/lib/format-currency'
import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/icons/inked'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLASS_TYPE_SUGGESTIONS = [
  'Boxing',
  'BJJ',
  'Muay Thai',
  'MMA',
  'Kickboxing',
  'Wrestling',
  'Judo',
  'Karate',
  'Yoga',
  'Strength',
  'Conditioning',
  'Personal Training',
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MembershipPlan {
  id: string
  name: string
  price_cents: number
  currency: string
  access_type: 'unlimited' | 'limited' | 'specific'
  classes_per_period: number | null
  applies_to: 'all' | 'types'
  applies_to_types: string[] | null
  status: 'active' | 'draft' | 'archived'
  memberCount: number
}

interface MemberRow {
  id: string
  clientName: string
  planName: string
  status: string
  classesUsed: number
  classesPerPeriod: number | null
}

type AccessType = 'unlimited' | 'limited' | 'specific'
type PlanStatus = 'active' | 'draft'

interface FormState {
  name: string
  priceDollars: string
  accessType: AccessType
  classesPerPeriod: string
  appliesToTypes: string[]
  status: PlanStatus
  typeInput: string
}

type FormErrors = Partial<Record<keyof FormState | 'appliesToTypes', string>>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function blankForm(): FormState {
  return {
    name: '',
    priceDollars: '0',
    accessType: 'unlimited',
    classesPerPeriod: '4',
    appliesToTypes: [],
    status: 'active',
    typeInput: '',
  }
}

function formFromPlan(p: MembershipPlan): FormState {
  return {
    name: p.name,
    priceDollars: (p.price_cents / 100).toFixed(2),
    accessType: p.access_type as AccessType,
    classesPerPeriod: p.classes_per_period != null ? String(p.classes_per_period) : '4',
    appliesToTypes: p.applies_to_types ?? [],
    status: (p.status === 'active' || p.status === 'draft') ? p.status : 'active',
    typeInput: '',
  }
}

function accessSummary(plan: MembershipPlan): string {
  if (plan.access_type === 'unlimited') return 'Unlimited'
  if (plan.access_type === 'limited') {
    const n = plan.classes_per_period ?? '?'
    return `${n} class${n === 1 ? '' : 'es'} / month`
  }
  // specific
  const types = plan.applies_to_types
  if (!types || types.length === 0) return 'Specific types'
  return types.slice(0, 2).join(', ') + (types.length > 2 ? ` +${types.length - 2}` : '')
}

function statusPillClass(status: string): string {
  if (status === 'active') return 'bg-emerald-500/15 text-emerald-400'
  if (status === 'trialing') return 'bg-blue-500/15 text-blue-400'
  if (status === 'past_due') return 'bg-amber-500/15 text-amber-400'
  return 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]'
}

function statusLabel(status: string): string {
  if (status === 'past_due') return 'Past due'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function validate(f: FormState): FormErrors {
  const errs: FormErrors = {}
  if (!f.name.trim()) errs.name = 'Name is required'
  const price = parseFloat(f.priceDollars)
  if (isNaN(price) || price < 0) errs.priceDollars = 'Price must be 0 or more'
  if (f.accessType === 'limited') {
    const n = parseInt(f.classesPerPeriod, 10)
    if (isNaN(n) || n < 1) errs.classesPerPeriod = 'Enter at least 1 class per month'
  }
  if (f.accessType === 'specific' && f.appliesToTypes.length === 0) {
    errs.appliesToTypes = 'Add at least one class type'
  }
  return errs
}

function buildPayload(f: FormState) {
  const priceCents = Math.round(parseFloat(f.priceDollars) * 100)
  return {
    name: f.name.trim(),
    priceCents,
    currency: 'usd',
    accessType: f.accessType,
    classesPerPeriod: f.accessType === 'limited' ? parseInt(f.classesPerPeriod, 10) : undefined,
    appliesTo: f.accessType === 'specific' ? 'types' : 'all',
    appliesToTypes: f.accessType === 'specific' ? f.appliesToTypes : undefined,
    status: f.status,
  } as const
}

// ---------------------------------------------------------------------------
// Segmented control (shared with ClassFormModal pattern)
// ---------------------------------------------------------------------------

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === opt.value
              ? 'bg-[var(--accent)] text-white shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plan form modal
// ---------------------------------------------------------------------------

interface PlanFormModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editPlan?: MembershipPlan | undefined
}

function PlanFormModal({ open, onClose, onSaved, editPlan }: PlanFormModalProps) {
  const [form, setForm] = useState<FormState>(blankForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(editPlan ? formFromPlan(editPlan) : blankForm())
      setErrors({})
      setSubmitError(null)
    }
  }, [open, editPlan])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function addType(raw: string) {
    const t = raw.trim()
    if (!t) return
    setForm((prev) => ({
      ...prev,
      appliesToTypes: prev.appliesToTypes.includes(t)
        ? prev.appliesToTypes
        : [...prev.appliesToTypes, t],
      typeInput: '',
    }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next.appliesToTypes
      return next
    })
  }

  function removeType(t: string) {
    setForm((prev) => ({
      ...prev,
      appliesToTypes: prev.appliesToTypes.filter((x) => x !== t),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setSubmitError(null)
    setSaving(true)
    try {
      const payload = buildPayload(form)
      let res: Response
      if (editPlan) {
        res = await fetch(`/api/coach/memberships/${editPlan.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/coach/memberships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSubmitError((json as { error?: string }).error ?? 'Something went wrong — try again')
        return
      }
      onSaved()
      onClose()
    } catch {
      setSubmitError('Network error — try again')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  const isEdit = Boolean(editPlan)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit membership plan' : 'New membership plan'}
    >
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-[var(--border-default)] bg-[var(--bg-app)] shadow-2xl max-h-[92dvh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-5 py-4">
          <h2 className="font-display text-lg font-medium text-[var(--text-primary)]">
            {isEdit ? 'Edit plan' : 'New membership plan'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5 px-5 py-5">

            {/* Name */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Plan name <span className="text-[var(--error)]">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Unlimited BJJ, 4-Class Pass"
                maxLength={200}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              {errors.name && <p className="mt-1 text-xs text-[var(--error)]">{errors.name}</p>}
            </div>

            {/* Price */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Price / month <span className="text-[var(--error)]">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-[var(--text-tertiary)]">
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.priceDollars}
                  onChange={(e) => set('priceDollars', e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] pl-7 pr-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>
              {errors.priceDollars && (
                <p className="mt-1 text-xs text-[var(--error)]">{errors.priceDollars}</p>
              )}
            </div>

            {/* Access type */}
            <div>
              <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">
                Access
              </label>
              <Segmented
                options={[
                  { label: 'Unlimited', value: 'unlimited' },
                  { label: 'X / month', value: 'limited' },
                  { label: 'Specific types', value: 'specific' },
                ]}
                value={form.accessType}
                onChange={(v) => set('accessType', v)}
              />

              {/* Conditional: classes per period */}
              {form.accessType === 'limited' && (
                <div className="mt-3">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    Classes per month <span className="text-[var(--error)]">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.classesPerPeriod}
                    onChange={(e) => set('classesPerPeriod', e.target.value)}
                    className="w-32 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                  {errors.classesPerPeriod && (
                    <p className="mt-1 text-xs text-[var(--error)]">{errors.classesPerPeriod}</p>
                  )}
                </div>
              )}

              {/* Conditional: class types chips */}
              {form.accessType === 'specific' && (
                <div className="mt-3 space-y-2">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">
                    Class types included <span className="text-[var(--error)]">*</span>
                  </label>
                  {/* Chips */}
                  {form.appliesToTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.appliesToTypes.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)]"
                        >
                          {t}
                          <button
                            type="button"
                            onClick={() => removeType(t)}
                            className="text-[var(--text-tertiary)] hover:text-[var(--error)]"
                            aria-label={`Remove ${t}`}
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Type input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      list="membership-type-suggestions"
                      value={form.typeInput}
                      onChange={(e) => set('typeInput', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addType(form.typeInput)
                        }
                      }}
                      placeholder="e.g. BJJ, Boxing…"
                      maxLength={100}
                      className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                    <datalist id="membership-type-suggestions">
                      {CLASS_TYPE_SUGGESTIONS.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                    <button
                      type="button"
                      onClick={() => addType(form.typeInput)}
                      className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                    >
                      Add
                    </button>
                  </div>
                  {errors.appliesToTypes && (
                    <p className="text-xs text-[var(--error)]">{errors.appliesToTypes}</p>
                  )}
                </div>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">
                Status
              </label>
              <Segmented
                options={[
                  { label: 'Active', value: 'active' },
                  { label: 'Draft', value: 'draft' },
                ]}
                value={form.status}
                onChange={(v) => set('status', v)}
              />
              <p className="mt-1.5 text-xs text-[var(--text-quaternary)]">
                Active plans create a Stripe subscription when a client signs up. Drafts are saved without billing.
              </p>
            </div>

          </div>

          {/* Footer */}
          <div className="sticky bottom-0 border-t border-[var(--border-subtle)] bg-[var(--bg-app)] px-5 py-4">
            {submitError && (
              <p className="mb-3 text-sm text-[var(--error)]">{submitError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[var(--accent-hover)] disabled:cursor-wait disabled:opacity-70"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving
                  ? isEdit ? 'Saving…' : 'Creating…'
                  : isEdit ? 'Save changes' : 'Create plan'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delete confirm dialog
// ---------------------------------------------------------------------------

interface DeleteConfirmProps {
  plan: MembershipPlan
  onCancel: () => void
  onConfirm: () => void
  deleting: boolean
}

function DeleteConfirm({ plan, onCancel, onConfirm, deleting }: DeleteConfirmProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-app)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
            Archive &ldquo;{plan.name}&rdquo;?
          </h3>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            The plan will be archived and no new subscriptions can be created. Existing active members keep access until their billing period ends.
          </p>
        </div>
        {plan.memberCount > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2.5 text-xs text-[var(--warning)]">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {plan.memberCount} active member{plan.memberCount !== 1 ? 's' : ''} on this plan.
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--error)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
          >
            {deleting && <Loader2 className="size-3.5 animate-spin" />}
            {deleting ? 'Archiving…' : 'Archive plan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page content
// ---------------------------------------------------------------------------

export function MembershipsContent() {
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])
  const [mrrCents, setMrrCents] = useState(0)
  const [memberTotal, setMemberTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | undefined>(undefined)

  const [deleteTarget, setDeleteTarget] = useState<MembershipPlan | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/coach/memberships')
      const json = await res.json().catch(() => ({})) as { data?: { plans?: MembershipPlan[]; mrrCents?: number; memberTotal?: number; members?: MemberRow[] }; error?: string }
      if (!res.ok) {
        throw new Error(json.error ?? 'Could not load memberships')
      }
      const d = json.data
      if (!d) throw new Error('Unexpected response from server')
      setPlans(d.plans ?? [])
      setMrrCents(d.mrrCents ?? 0)
      setMemberTotal(d.memberTotal ?? 0)
      setMembers(d.members ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/coach/memberships/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert((json as { error?: string }).error ?? 'Could not archive plan')
        return
      }
      setDeleteTarget(null)
      await load()
    } catch {
      alert('Network error — try again')
    } finally {
      setDeleting(false)
    }
  }

  const activePlans = plans.filter((p) => p.status !== 'archived')

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">

        {/* Page header */}
        <PageHeader
          title="Memberships"
          icon={<Icon name="memberships" />}
          {...(activePlans.length > 0 ? { countLabel: `${activePlans.length} active` } : {})}
        >
          <button
            type="button"
            onClick={() => { setEditingPlan(undefined); setModalOpen(true) }}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--accent-hover)]"
          >
            <Plus className="size-4" />
            New plan
          </button>
        </PageHeader>
        <p className="-mt-2 text-sm text-[var(--text-tertiary)]">
          Recurring plans clients pay monthly — billed automatically through Stripe.
        </p>

        {/* Loading */}
        {loading && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-10 text-center">
            <Loader2 className="mx-auto size-5 animate-spin text-[var(--text-tertiary)]" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] p-4 text-sm text-[var(--error)]">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* MRR strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
              <Card className="px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-widest text-[var(--text-quaternary)]">
                  Monthly revenue
                </p>
                <p className="mt-1 font-display text-2xl font-medium text-[var(--text-primary)]">
                  {formatCents(mrrCents)}
                </p>
              </Card>
              <Card className="px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-widest text-[var(--text-quaternary)]">
                  Active members
                </p>
                <p className="mt-1 font-display text-2xl font-medium text-[var(--text-primary)]">
                  {memberTotal}
                </p>
              </Card>
            </div>

            {/* Plans section */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--text-quaternary)]">
                Plans
              </h2>

              {activePlans.length === 0 ? (
                <EmptyState
                  title="No plans yet"
                  description="Create your first membership plan — clients subscribe and are billed monthly via Stripe."
                  action={
                    <button
                      type="button"
                      onClick={() => { setEditingPlan(undefined); setModalOpen(true) }}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
                    >
                      <Plus className="size-4" /> New plan
                    </button>
                  }
                />
              ) : (
                <div className="space-y-2">
                  {activePlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="flex items-center gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)] px-5 py-4"
                    >
                      {/* Plan info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-[var(--text-primary)]">{plan.name}</p>
                          {plan.status === 'draft' && (
                            <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-xs font-medium text-[var(--text-tertiary)]">
                              Draft
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                          {formatCents(plan.price_cents)}/mo &middot; {accessSummary(plan)}
                        </p>
                      </div>

                      {/* Member count */}
                      <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                        <Users className="size-3.5" />
                        {plan.memberCount}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { setEditingPlan(plan); setModalOpen(true) }}
                          className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] transition-colors"
                          aria-label={`Edit ${plan.name}`}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(plan)}
                          className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--error)] transition-colors"
                          aria-label={`Archive ${plan.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Members section */}
            {members.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--text-quaternary)]">
                  Members
                </h2>
                <Card className="overflow-hidden p-0">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 border-b border-[var(--border-subtle)] px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-quaternary)]">
                    <span>Client</span>
                    <span>Plan</span>
                    <span className="text-right">Usage</span>
                    <span className="text-right">Status</span>
                  </div>
                  <ul>
                    {members.map((m) => (
                      <li
                        key={m.id}
                        className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-3.5 last:border-b-0"
                      >
                        <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {m.clientName}
                        </span>
                        <span className="truncate text-sm text-[var(--text-secondary)]">
                          {m.planName}
                        </span>
                        <span className="text-right text-xs text-[var(--text-tertiary)] tabular-nums">
                          {m.classesPerPeriod != null
                            ? `${m.classesUsed} / ${m.classesPerPeriod}`
                            : '—'}
                        </span>
                        <span
                          className={[
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            statusPillClass(m.status),
                          ].join(' ')}
                        >
                          {statusLabel(m.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            )}
          </>
        )}
      </div>

      {/* Plan form modal */}
      <PlanFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingPlan(undefined) }}
        onSaved={() => { void load() }}
        editPlan={editingPlan}
      />

      {/* Delete confirm */}
      {deleteTarget && (
        <DeleteConfirm
          plan={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void handleDelete()}
          deleting={deleting}
        />
      )}
    </main>
  )
}
