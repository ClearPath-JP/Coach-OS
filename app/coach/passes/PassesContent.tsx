'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Pencil, Trash2, X, Ticket, AlertTriangle } from 'lucide-react'
import { formatCents } from '@/lib/format-currency'
import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/icons/inked'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

const CLASS_TYPE_SUGGESTIONS = [
  'Boxing', 'BJJ', 'Muay Thai', 'MMA', 'Kickboxing', 'Wrestling',
  'Judo', 'Karate', 'Yoga', 'Strength', 'Conditioning', 'Personal Training',
]

interface ClassPass {
  id: string
  title: string
  description: string | null
  price_cents: number
  currency: string
  credit_count: number
  applies_to: 'all' | 'types'
  applies_to_types: string[] | null
  expires_in_days: number | null
  status: 'active' | 'draft' | 'archived'
  holders: number
  creditsOutstanding: number
}

type Scope = 'all' | 'types'
type PassStatus = 'active' | 'draft'

interface FormState {
  title: string
  priceDollars: string
  creditCount: string
  scope: Scope
  appliesToTypes: string[]
  expiresInDays: string
  status: PassStatus
  typeInput: string
}

type FormErrors = Partial<Record<keyof FormState, string>>

function blankForm(): FormState {
  return { title: '', priceDollars: '0', creditCount: '10', scope: 'all', appliesToTypes: [], expiresInDays: '', status: 'active', typeInput: '' }
}

function formFromPass(p: ClassPass): FormState {
  return {
    title: p.title,
    priceDollars: (p.price_cents / 100).toFixed(2),
    creditCount: String(p.credit_count),
    scope: p.applies_to === 'types' ? 'types' : 'all',
    appliesToTypes: p.applies_to_types ?? [],
    expiresInDays: p.expires_in_days != null ? String(p.expires_in_days) : '',
    status: p.status === 'draft' ? 'draft' : 'active',
    typeInput: '',
  }
}

function scopeSummary(p: ClassPass): string {
  if (p.applies_to !== 'types') return 'Any class'
  const types = p.applies_to_types
  if (!types || types.length === 0) return 'Specific types'
  return types.slice(0, 2).join(', ') + (types.length > 2 ? ` +${types.length - 2}` : '')
}

function validate(f: FormState): FormErrors {
  const errs: FormErrors = {}
  if (!f.title.trim()) errs.title = 'Title is required'
  const price = parseFloat(f.priceDollars)
  if (isNaN(price) || price <= 0) errs.priceDollars = 'Price must be more than $0'
  const credits = parseInt(f.creditCount, 10)
  if (isNaN(credits) || credits < 1) errs.creditCount = 'Enter at least 1 class'
  if (f.scope === 'types' && f.appliesToTypes.length === 0) errs.appliesToTypes = 'Add at least one class type'
  if (f.expiresInDays.trim() !== '') {
    const d = parseInt(f.expiresInDays, 10)
    if (isNaN(d) || d < 1) errs.expiresInDays = 'Days must be 1+ (or blank for no expiry)'
  }
  return errs
}

function buildPayload(f: FormState) {
  return {
    title: f.title.trim(),
    priceCents: Math.round(parseFloat(f.priceDollars) * 100),
    currency: 'usd',
    creditCount: parseInt(f.creditCount, 10),
    appliesTo: f.scope === 'types' ? 'types' : 'all',
    appliesToTypes: f.scope === 'types' ? f.appliesToTypes : undefined,
    expiresInDays: f.expiresInDays.trim() === '' ? null : parseInt(f.expiresInDays, 10),
    status: f.status,
  } as const
}

function Segmented<T extends string>({ options, value, onChange }: { options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === opt.value ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

interface PassFormModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editPass?: ClassPass | undefined
}

function PassFormModal({ open, onClose, onSaved, editPass }: PassFormModalProps) {
  const [form, setForm] = useState<FormState>(blankForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(editPass ? formFromPass(editPass) : blankForm())
      setErrors({})
      setSubmitError(null)
    }
  }, [open, editPass])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
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
      appliesToTypes: prev.appliesToTypes.includes(t) ? prev.appliesToTypes : [...prev.appliesToTypes, t],
      typeInput: '',
    }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next.appliesToTypes
      return next
    })
  }

  function removeType(t: string) {
    setForm((prev) => ({ ...prev, appliesToTypes: prev.appliesToTypes.filter((x) => x !== t) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate(form)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSubmitError(null)
    setSaving(true)
    try {
      const payload = buildPayload(form)
      const res = editPass
        ? await fetch(`/api/coach/passes/${editPass.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/coach/passes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setSubmitError((json as { error?: string }).error ?? 'Something went wrong — try again'); return }
      onSaved()
      onClose()
    } catch {
      setSubmitError('Network error — try again')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  const isEdit = Boolean(editPass)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit pass' : 'New pass'}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-[var(--border-default)] bg-[var(--bg-app)] shadow-2xl max-h-[92dvh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-app)] px-5 py-4">
          <h2 className="font-display text-lg font-medium text-[var(--text-primary)]">{isEdit ? 'Edit pass' : 'New pass'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5 px-5 py-5">
            {/* Title */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Pass name <span className="text-[var(--error)]">*</span></label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. 10-Class Pass"
                maxLength={200}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              {errors.title && <p className="mt-1 text-xs text-[var(--error)]">{errors.title}</p>}
            </div>

            {/* Credits + Price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Classes included <span className="text-[var(--error)]">*</span></label>
                <input
                  type="number"
                  min={1}
                  value={form.creditCount}
                  onChange={(e) => set('creditCount', e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
                {errors.creditCount && <p className="mt-1 text-xs text-[var(--error)]">{errors.creditCount}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Price <span className="text-[var(--error)]">*</span></label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-[var(--text-tertiary)]">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.priceDollars}
                    onChange={(e) => set('priceDollars', e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] pl-7 pr-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
                {errors.priceDollars && <p className="mt-1 text-xs text-[var(--error)]">{errors.priceDollars}</p>}
              </div>
            </div>

            {/* Scope */}
            <div>
              <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">Use it for</label>
              <Segmented
                options={[{ label: 'Any class', value: 'all' }, { label: 'Specific types', value: 'types' }]}
                value={form.scope}
                onChange={(v) => set('scope', v)}
              />
              {form.scope === 'types' && (
                <div className="mt-3 space-y-2">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">Class types <span className="text-[var(--error)]">*</span></label>
                  {form.appliesToTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.appliesToTypes.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)]">
                          {t}
                          <button type="button" onClick={() => removeType(t)} className="text-[var(--text-tertiary)] hover:text-[var(--error)]" aria-label={`Remove ${t}`}>
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      list="pass-type-suggestions"
                      value={form.typeInput}
                      onChange={(e) => set('typeInput', e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addType(form.typeInput) } }}
                      placeholder="e.g. BJJ, Boxing…"
                      maxLength={100}
                      className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                    <datalist id="pass-type-suggestions">
                      {CLASS_TYPE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}
                    </datalist>
                    <button type="button" onClick={() => addType(form.typeInput)} className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]">Add</button>
                  </div>
                  {errors.appliesToTypes && <p className="text-xs text-[var(--error)]">{errors.appliesToTypes}</p>}
                </div>
              )}
            </div>

            {/* Expiry */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Expires after (days)</label>
              <input
                type="number"
                min={1}
                value={form.expiresInDays}
                onChange={(e) => set('expiresInDays', e.target.value)}
                placeholder="Leave blank = never expires"
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              {errors.expiresInDays && <p className="mt-1 text-xs text-[var(--error)]">{errors.expiresInDays}</p>}
            </div>

            {/* Status */}
            <div>
              <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">Status</label>
              <Segmented options={[{ label: 'Active', value: 'active' }, { label: 'Draft', value: 'draft' }]} value={form.status} onChange={(v) => set('status', v)} />
              <p className="mt-1.5 text-xs text-[var(--text-quaternary)]">Active passes are sold to clients right away. Drafts stay hidden until you publish.</p>
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-[var(--border-subtle)] bg-[var(--bg-app)] px-5 py-4">
            {submitError && <p className="mb-3 text-sm text-[var(--error)]">{submitError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[var(--accent-hover)] disabled:cursor-wait disabled:opacity-70">
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save changes' : 'Create pass')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

interface DeleteConfirmProps {
  pass: ClassPass
  onCancel: () => void
  onConfirm: () => void
  deleting: boolean
  error?: string | null
}

function DeleteConfirm({ pass, onCancel, onConfirm, deleting, error }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-app)] p-5" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">Archive &ldquo;{pass.title}&rdquo;?</h3>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">It will be hidden from clients and can&rsquo;t be bought. Credits clients already own keep working until used or expired.</p>
        </div>
        {pass.creditsOutstanding > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2.5 text-xs text-[var(--warning)]">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {pass.creditsOutstanding} credit{pass.creditsOutstanding !== 1 ? 's' : ''} still outstanding across {pass.holders} client{pass.holders !== 1 ? 's' : ''}.
          </div>
        )}
        {error && <p className="rounded-lg px-3 py-2 text-xs text-[var(--error)]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={deleting} className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] disabled:opacity-50">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={deleting} className="inline-flex items-center gap-2 rounded-lg bg-[var(--error)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-70">
            {deleting && <Loader2 className="size-3.5 animate-spin" />}
            {deleting ? 'Archiving…' : 'Archive pass'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function PassesContent() {
  const [passes, setPasses] = useState<ClassPass[]>([])
  const [holderTotal, setHolderTotal] = useState(0)
  const [creditsOutstanding, setCreditsOutstanding] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingPass, setEditingPass] = useState<ClassPass | undefined>(undefined)

  const [deleteTarget, setDeleteTarget] = useState<ClassPass | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/coach/passes')
      const json = (await res.json().catch(() => ({}))) as { data?: { passes?: ClassPass[]; holderTotal?: number; creditsOutstanding?: number }; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Could not load passes')
      const d = json.data
      if (!d) throw new Error('Unexpected response from server')
      setPasses(d.passes ?? [])
      setHolderTotal(d.holderTotal ?? 0)
      setCreditsOutstanding(d.creditsOutstanding ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/coach/passes/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setDeleteError((json as { error?: string }).error ?? 'Could not archive pass')
        return
      }
      setDeleteTarget(null)
      await load()
    } catch {
      setDeleteError('Network error — try again')
    } finally {
      setDeleting(false)
    }
  }

  const activePasses = passes.filter((p) => p.status !== 'archived')

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <PageHeader
          title="Passes"
          icon={<Icon name="packages" />}
          {...(activePasses.length > 0 ? { countLabel: `${activePasses.length} active` } : {})}
        >
          <button
            type="button"
            onClick={() => { setEditingPass(undefined); setModalOpen(true) }}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--accent-hover)]"
          >
            <Plus className="size-4" />
            New pass
          </button>
        </PageHeader>
        <p className="-mt-2 text-sm text-[var(--text-tertiary)]">
          Prepaid class packs — clients buy credits up front, then spend one per class booking.
        </p>

        {loading && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-10 text-center">
            <Loader2 className="mx-auto size-5 animate-spin text-[var(--text-tertiary)]" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] p-4 text-sm text-[var(--error)]">{error}</div>
        )}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Card className="px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-widest text-[var(--text-quaternary)]">Credits outstanding</p>
                <p className="mt-1 font-display text-2xl font-medium text-[var(--text-primary)]">{creditsOutstanding}</p>
              </Card>
              <Card className="px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-widest text-[var(--text-quaternary)]">Clients with passes</p>
                <p className="mt-1 font-display text-2xl font-medium text-[var(--text-primary)]">{holderTotal}</p>
              </Card>
            </div>

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--text-quaternary)]">Passes</h2>
              {activePasses.length === 0 ? (
                <EmptyState
                  title="No passes yet"
                  description="Create your first pass — e.g. a 10-class pack. Clients buy it and a credit is spent each time they book."
                  action={
                    <button type="button" onClick={() => { setEditingPass(undefined); setModalOpen(true) }} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]">
                      <Plus className="size-4" /> New pass
                    </button>
                  }
                />
              ) : (
                <div className="space-y-2">
                  {activePasses.map((pass) => (
                    <div key={pass.id} className="flex items-center gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)] px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-[var(--text-primary)]">{pass.title}</p>
                          {pass.status === 'draft' && (
                            <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-xs font-medium text-[var(--text-tertiary)]">Draft</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                          {pass.credit_count} classes &middot; {formatCents(pass.price_cents)} &middot; {scopeSummary(pass)}
                          {pass.expires_in_days != null ? ` · expires ${pass.expires_in_days}d` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]" title={`${pass.creditsOutstanding} credits outstanding`}>
                        <Ticket className="size-3.5" />
                        {pass.creditsOutstanding}
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => { setEditingPass(pass); setModalOpen(true) }} className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] transition-colors" aria-label={`Edit ${pass.title}`}>
                          <Pencil className="size-3.5" />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(pass)} className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--error)] transition-colors" aria-label={`Archive ${pass.title}`}>
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <PassFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingPass(undefined) }}
        onSaved={() => { void load() }}
        editPass={editingPass}
      />

      {deleteTarget && (
        <DeleteConfirm
          pass={deleteTarget}
          onCancel={() => { setDeleteTarget(null); setDeleteError(null) }}
          onConfirm={() => void handleDelete()}
          deleting={deleting}
          error={deleteError}
        />
      )}
    </main>
  )
}
