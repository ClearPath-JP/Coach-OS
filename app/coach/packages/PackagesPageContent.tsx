'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Icon } from '@/components/icons/inked'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { createPackageSchema, createInvoiceSchema, type CreatePackageInput, type CreateInvoiceInput } from '@/lib/validations'

type Package = {
  id: string
  title: string
  description: string | null
  price_cents: number
  currency: string
  duration_minutes: number
  session_type: string | null
  is_virtual: boolean
  is_active: boolean
  created_at: string
}

type Client = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase() === 'USD' ? 'USD' : currency,
  }).format(cents / 100)
}

function PackageCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <div className="h-5 w-2/3 rounded bg-[var(--color-border)]" />
      <div className="mt-2 h-4 w-full rounded bg-[var(--color-border)]" />
      <div className="mt-4 h-6 w-1/3 rounded bg-[var(--color-border)]" />
      <div className="mt-4 flex gap-2">
        <div className="h-10 flex-1 rounded-lg bg-[var(--color-border)]" />
        <div className="h-10 flex-1 rounded-lg bg-[var(--color-border)]" />
      </div>
    </Card>
  )
}

type PackageFormModalProps = {
  isOpen: boolean
  initialPackage: Package | null
  submitting: boolean
  submitError: string | null
  onClose: () => void
  onSave: (payload: CreatePackageInput) => Promise<void>
}

function PackageFormModal({
  isOpen,
  initialPackage,
  submitting,
  submitError,
  onClose,
  onSave,
}: PackageFormModalProps) {
  const [form, setForm] = useState<CreatePackageInput>(() =>
    initialPackage
      ? {
          title: initialPackage.title,
          description: initialPackage.description ?? '',
          price_cents: initialPackage.price_cents,
          currency: initialPackage.currency,
          duration_minutes: initialPackage.duration_minutes,
          session_type: initialPackage.session_type ?? '',
          is_virtual: initialPackage.is_virtual ?? true,
          is_active: initialPackage.is_active,
          capacity: (initialPackage as { capacity?: number }).capacity ?? 1,
        }
      : {
          title: '',
          description: '',
          price_cents: 0,
          currency: 'usd',
          duration_minutes: 60,
          session_type: '',
          is_virtual: true,
          is_active: true,
          capacity: 1,
        }
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave(form)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialPackage ? 'Edit package' : 'Create package'}
      className="w-full max-w-none md:max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Title *</label>
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Single session"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Description</label>
          <Textarea
            value={form.description ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Optional"
            rows={2}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Price (USD) *</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.price_cents ? (form.price_cents / 100).toFixed(2) : ''}
            onChange={(e) => setForm((f) => ({ ...f, price_cents: Math.round(parseFloat(e.target.value || '0') * 100) }))}
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Duration (minutes)</label>
          <Input
            type="number"
            min="5"
            max="480"
            value={form.duration_minutes || ''}
            onChange={(e) => setForm((f) => ({ ...f, duration_minutes: parseInt(e.target.value || '60', 10) }))}
            placeholder="60"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">
            Capacity (max attendees)
          </label>
          <Input
            type="number"
            min="1"
            max="50"
            value={form.capacity || 1}
            onChange={(e) => setForm((f) => ({ ...f, capacity: Math.max(1, parseInt(e.target.value || '1', 10)) }))}
            placeholder="1"
          />
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            1 = 1-on-1 session. Higher = group class. Clients see &quot;X/{form.capacity ?? 1} booked&quot; when this class is bookable from their portal.
          </p>
        </div>
        <div>
          <span className="mb-2 block text-sm font-medium text-[var(--color-ink)]">Session format</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`min-h-[40px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                form.is_virtual
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]'
              }`}
              onClick={() => setForm((f) => ({ ...f, is_virtual: true }))}
            >
              Online
            </button>
            <button
              type="button"
              className={`min-h-[40px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                !form.is_virtual
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)]'
              }`}
              onClick={() => setForm((f) => ({ ...f, is_virtual: false }))}
            >
              In-person
            </button>
          </div>
          {form.is_virtual ? (
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              Tip: online sessions are often priced 20–30% lower than in-person.
            </p>
          ) : null}
        </div>
        {submitError && <p className="text-sm text-[var(--color-error)]">{submitError}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : initialPackage ? 'Save changes' : 'Create package'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function PackagesPageContent() {
  const [packages, setPackages] = useState<Package[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editPkg, setEditPkg] = useState<Package | null>(null)
  const [sendInvoicePkg, setSendInvoicePkg] = useState<Package | null>(null)
  const [invoiceForm, setInvoiceForm] = useState<CreateInvoiceInput>({
    packageId: '',
    clientId: '',
    dueDate: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fetchPackages = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/packages')
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load packages')
        setPackages([])
        return
      }
      setPackages(json.data ?? [])
    } catch {
      setError('Something went wrong — check your connection and try again')
      setPackages([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients')
      const json = await res.json()
      if (res.ok) setClients(json.data ?? [])
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchPackages()
  }, [fetchPackages])

  useEffect(() => {
    if (createOpen || sendInvoicePkg) fetchClients()
  }, [createOpen, sendInvoicePkg, fetchClients])

  const openEdit = (pkg: Package) => {
    setEditPkg(pkg)
    setCreateOpen(true)
    setSubmitError(null)
  }

  const openSendInvoice = (pkg: Package) => {
    setSendInvoicePkg(pkg)
    setInvoiceForm({
      packageId: pkg.id,
      clientId: '',
      dueDate: '',
    })
    setSubmitError(null)
  }

  const handleCreateOrUpdate = async (payload: CreatePackageInput) => {
    setSubmitError(null)
    const parsed = createPackageSchema.safeParse({
      ...payload,
      description: payload.description || null,
      session_type: payload.session_type || null,
    })
    if (!parsed.success) {
      setSubmitError(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }
    setSubmitting(true)
    try {
      const url = editPkg ? `/api/packages/${editPkg.id}` : '/api/packages'
      const method = editPkg ? 'PATCH' : 'POST'
      const body = editPkg
        ? {
            title: parsed.data.title,
            description: parsed.data.description,
            price_cents: parsed.data.price_cents,
            currency: parsed.data.currency,
            duration_minutes: parsed.data.duration_minutes,
            session_type: parsed.data.session_type,
            is_virtual: parsed.data.is_virtual,
            is_active: parsed.data.is_active,
          }
        : parsed.data
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error ?? 'Could not save package')
        return
      }
      setCreateOpen(false)
      setEditPkg(null)
      fetchPackages()
    } catch {
      setSubmitError('Something went wrong — try again')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sendInvoicePkg) return
    setSubmitError(null)
    const parsed = createInvoiceSchema.safeParse({
      packageId: sendInvoicePkg.id,
      clientId: invoiceForm.clientId || undefined,
      dueDate: invoiceForm.dueDate || null,
    })
    if (!parsed.success) {
      setSubmitError(parsed.error.issues[0]?.message ?? 'Select a client')
      return
    }
    if (!parsed.data.clientId) {
      setSubmitError('Please select a client')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error ?? 'Could not send invoice')
        return
      }
      setSendInvoicePkg(null)
      setInvoiceForm({ packageId: '', clientId: '', dueDate: '' })
      fetchPackages()
      window.location.href = '/coach/messages'
    } catch {
      setSubmitError('Something went wrong — try again')
    } finally {
      setSubmitting(false)
    }
  }

  const activePackageCount = packages.filter((p) => p.is_active).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Session packages"
        icon={<Icon name="packages" />}
        {...(activePackageCount > 0 ? { countLabel: `${activePackageCount} active` } : {})}
      >
        <Link href="/coach/invoices">
          <Button variant="secondary" size="sm">
            Invoice history
          </Button>
        </Link>
        <Button
          size="sm"
          onClick={() => {
            setCreateOpen(true)
            setEditPkg(null)
            setSubmitError(null)
          }}
        >
          Create package
        </Button>
      </PageHeader>
      <p className="-mt-2 text-[14px] font-normal leading-[1.6] text-[var(--text-tertiary)]">
        Create packages and send invoices to clients from here or in messages.
      </p>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <PackageCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-6 text-center">
          <p className="text-[14px] text-[var(--text-secondary)]">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={fetchPackages}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && packages.length === 0 && (
        <EmptyState
          title="No packages yet"
          description="Create session packages with set pricing and session counts. Send invoices to clients and track payments automatically."
          action={<Button onClick={() => setCreateOpen(true)}>Create package</Button>}
        />
      )}

      {!loading && !error && packages.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packages.filter((p) => p.is_active).map((pkg) => (
            <Card key={pkg.id} variant="raised" padding="lg" className="shadow-[var(--shadow-xs)]">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{pkg.title}</h3>
              </div>
              {pkg.description && (
                <p className="mt-1 text-[13px] leading-snug text-[var(--text-tertiary)] line-clamp-2">{pkg.description}</p>
              )}
              <p className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                {formatAmount(pkg.price_cents, pkg.currency)}
              </p>
              {pkg.duration_minutes > 0 && (
                <p className="mt-1 text-[12px] text-[var(--text-quaternary)]">
                  {pkg.duration_minutes} min
                  {pkg.session_type ? ` · ${pkg.session_type}` : ''}
                </p>
              )}
              <p className="mt-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                    pkg.is_virtual !== false
                      ? 'bg-[var(--accent-light)] text-[var(--cp-accent)]'
                      : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]'
                  }`}
                >
                  {pkg.is_virtual !== false ? 'Virtual' : 'In-person'}
                </span>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  className="min-h-[44px]"
                  onClick={() => openSendInvoice(pkg)}
                >
                  Send invoice
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-[44px]"
                  onClick={() => openEdit(pkg)}
                >
                  Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <PackageFormModal
        key={createOpen ? (editPkg?.id ?? '__create__') : '__closed__'}
        isOpen={createOpen}
        initialPackage={editPkg}
        submitting={submitting}
        submitError={submitError}
        onClose={() => {
          setCreateOpen(false)
          setEditPkg(null)
          setSubmitError(null)
        }}
        onSave={handleCreateOrUpdate}
      />

      <Modal
        isOpen={!!sendInvoicePkg}
        onClose={() => { setSendInvoicePkg(null); setSubmitError(null); }}
        title="Send invoice"
        className="w-full max-w-none md:max-w-md"
      >
        {sendInvoicePkg && (
          <form onSubmit={handleSendInvoice} className="space-y-4">
            <p className="text-sm text-[var(--color-muted)]">
              Sending invoice for <strong>{sendInvoicePkg.title}</strong> ({formatAmount(sendInvoicePkg.price_cents, sendInvoicePkg.currency)})
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Client *</label>
              <select
                value={invoiceForm.clientId}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, clientId: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-[15px] min-h-[44px]"
                required
              >
                <option value="">Select a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || c.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Due date</label>
              <Input
                type="date"
                value={invoiceForm.dueDate ?? ''}
                onChange={(e) => setInvoiceForm((f) => ({ ...f, dueDate: e.target.value || undefined }))}
              />
            </div>
            {submitError && <p className="text-sm text-[var(--color-error)]">{submitError}</p>}
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="secondary" onClick={() => setSendInvoicePkg(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send invoice'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
