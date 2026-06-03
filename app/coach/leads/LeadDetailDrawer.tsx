'use client'

/**
 * LeadDetailDrawer — right-side slide-in panel for the Lead Research CRM.
 *
 * Standalone: does NOT import CoachLeadsContent. Wire it in a later step.
 * Calls two API endpoints directly:
 *   POST /api/coach/leads/outreach  — AI DM draft
 *   POST /api/clients               — create client from lead
 */

import { useEffect, useRef, useState } from 'react'
import { Copy, ExternalLink, Loader2, Mail, MessageSquare, UserPlus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type LeadStatus } from '@/lib/leads-interactions'
import { type MergedLead, PlatformIcon, StatusDropdown, safeMailto, safeUrl } from './lead-ui'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LeadDetailDrawerProps {
  lead: MergedLead | null
  coachContext: { discipline?: string; gymName?: string; area?: string }
  onClose: () => void
  onStatusChange: (lead: MergedLead, status: LeadStatus) => void
  onNotesChange: (lead: MergedLead, notes: string) => void // called on blur, only if changed
  onSavedClient: (lead: MergedLead, clientId: string) => void
}

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || parts[0] === '') return '?'
  if (parts.length === 1) return (parts[0]![0] ?? '?').toUpperCase()
  return ((parts[0]![0] ?? '') + (parts[parts.length - 1]![0] ?? '')).toUpperCase()
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  const first = parts[0] ?? ''
  const last = parts.slice(1).join(' ')
  return { firstName: first, lastName: last }
}

// ---------------------------------------------------------------------------
// Save-to-client inline form
// ---------------------------------------------------------------------------

interface SaveFormProps {
  lead: MergedLead
  onSaved: (clientId: string) => void
}

function SaveForm({ lead, onSaved }: SaveFormProps) {
  const { firstName: defaultFirst, lastName: defaultLast } = splitName(lead.name)
  const [firstName, setFirstName] = useState(defaultFirst)
  const [lastName, setLastName] = useState(defaultLast)
  const [email, setEmail] = useState(lead.email ?? '')
  const [phone, setPhone] = useState('')
  const [goals, setGoals] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ tempPassword: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          goals: goals.trim() || undefined,
        }),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = (await res.json()) as Record<string, any>

      if (!res.ok || typeof json.error === 'string') {
        setError(typeof json.error === 'string' ? json.error : 'Something went wrong. Please try again.')
        return
      }

      const clientId: string | undefined = json.data?.client?.id
      const tempPassword: string | undefined = json.data?.tempPassword
      if (typeof clientId !== 'string' || typeof tempPassword !== 'string') {
        setError('Unexpected server response. Please try again.')
        return
      }
      setSuccess({ tempPassword })
      onSaved(clientId)
    } catch {
      setError('Network error — check your connection.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1.5">
        <p className="text-xs font-semibold text-emerald-400">Client created!</p>
        <p className="text-[11px] text-[var(--text-secondary)]">
          Temporary password:{' '}
          <span className="font-mono font-semibold text-[var(--text-primary)]">
            {success.tempPassword}
          </span>
        </p>
        <p className="text-[11px] text-[var(--text-tertiary)]">
          Share this temporary password with the client so they can log in.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-quaternary)] mb-1">
            First name
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-app)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-quaternary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-quaternary)] mb-1">
            Last name
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-app)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-quaternary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-quaternary)] mb-1">
          Email <span className="text-red-400">*</span>
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-app)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-quaternary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
        />
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-quaternary)] mb-1">
          Phone (optional)
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-app)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-quaternary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
        />
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-quaternary)] mb-1">
          Goals (optional)
        </label>
        <textarea
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-md border border-[var(--border-default)] bg-[var(--bg-app)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-quaternary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-500/10 border border-red-500/30 px-2.5 py-2 text-[11px] text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent)]/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="size-3 animate-spin" /> : <UserPlus className="size-3" />}
        {loading ? 'Creating…' : 'Create client'}
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// AI outreach section
// ---------------------------------------------------------------------------

interface OutreachSectionProps {
  lead: MergedLead
  coachContext: { discipline?: string; gymName?: string; area?: string }
  targetRef: React.RefObject<HTMLElement | null>
}

function OutreachSection({ lead, coachContext, targetRef }: OutreachSectionProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [text, setText] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function generate() {
    setStatus('loading')
    setErrMsg(null)
    try {
      const res = await fetch('/api/coach/leads/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lead.name,
          handle: lead.handle,
          platform: lead.platform,
          reason: lead.reason,
          bio: lead.bio,
          ...coachContext,
        }),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = (await res.json()) as Record<string, any>
      const errorMsg: string | undefined =
        typeof json.error === 'string' ? json.error : undefined
      if (!res.ok || errorMsg) {
        const msg =
          res.status === 429
            ? 'Too many requests — wait a minute and try again.'
            : res.status === 503
              ? 'AI is not configured on this account.'
              : (errorMsg ?? 'Could not generate a message.')
        setErrMsg(msg)
        setStatus('error')
        return
      }
      const generatedText: string =
        typeof json.data?.text === 'string' ? json.data.text : ''
      setText(generatedText)
      setStatus('done')
      // scroll the target into view
      targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } catch {
      setErrMsg('Network error — check your connection.')
      setStatus('error')
    }
  }

  async function copyText() {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard access denied or unavailable — silently ignore
    }
  }

  return (
    <div ref={targetRef as React.RefObject<HTMLDivElement>} className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-quaternary)]">
          AI outreach draft
        </h4>
        <button
          type="button"
          onClick={generate}
          disabled={status === 'loading'}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <MessageSquare className="size-3" />
              {status === 'done' ? 'Regenerate' : 'Generate'}
            </>
          )}
        </button>
      </div>

      <p className="text-[10px] text-[var(--text-quaternary)] italic">
        Personalized to their bio + your gym.
      </p>

      {status === 'error' && errMsg && (
        <p className="rounded-md bg-red-500/10 border border-red-500/30 px-2.5 py-2 text-[11px] text-red-400">
          {errMsg}
        </p>
      )}

      {status === 'done' && text && (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 space-y-2">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
            {text}
          </p>
          <button
            type="button"
            onClick={copyText}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent)]"
          >
            <Copy className="size-3" />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// LeadDetailDrawer
// ---------------------------------------------------------------------------

export function LeadDetailDrawer({
  lead,
  coachContext,
  onClose,
  onStatusChange,
  onNotesChange,
  onSavedClient,
}: LeadDetailDrawerProps) {
  // Notes state — tracks what's persisted so we only call onNotesChange on actual change
  const [notesValue, setNotesValue] = useState(lead?.notes ?? '')
  const notesOriginalRef = useRef(lead?.notes ?? '')

  // "Save to clients" form toggle
  const [showSaveForm, setShowSaveForm] = useState(false)

  // "Copy handle" flash
  const [copiedHandle, setCopiedHandle] = useState(false)

  // Ref for scrolling to outreach section
  const outreachRef = useRef<HTMLElement>(null)

  // Ref for the scrollable body — reset to top whenever a different lead opens
  const scrollBodyRef = useRef<HTMLDivElement>(null)

  // Sync local notes state when the lead prop changes (different row opened)
  useEffect(() => {
    setNotesValue(lead?.notes ?? '')
    notesOriginalRef.current = lead?.notes ?? ''
    setShowSaveForm(false)
    setCopiedHandle(false)
    // Reset scroll to top so the drawer always opens at the header, not the AI section
    scrollBodyRef.current?.scrollTo(0, 0)
  }, [lead?.leadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key handler
  useEffect(() => {
    if (!lead) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [lead, onClose])

  // Nothing to render when closed
  if (!lead) return null

  // Narrow to non-null once so closures below don't need optional chaining
  const openLead: MergedLead = lead

  const profileUrl = safeUrl(openLead.url)
  const mailtoHref = safeMailto(openLead.email)

  async function copyHandle() {
    if (!openLead.handle) return
    try {
      await navigator.clipboard.writeText(openLead.handle)
      setCopiedHandle(true)
      setTimeout(() => setCopiedHandle(false), 1500)
    } catch {
      // clipboard access denied or unavailable — silently ignore
    }
  }

  function handleNotesBlur() {
    if (notesValue !== notesOriginalRef.current) {
      notesOriginalRef.current = notesValue
      onNotesChange(openLead, notesValue)
    }
  }

  function handleSaved(clientId: string) {
    setShowSaveForm(false)
    onSavedClient(openLead, clientId)
  }

  function scrollToOutreach() {
    outreachRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const inits = initials(openLead.name)

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Lead details for ${openLead.name}`}
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-[380px] max-w-full flex-col',
          'bg-[var(--bg-app)] border-l border-[var(--border-default)]',
          'shadow-2xl',
          'animate-in slide-in-from-right duration-250'
        )}
      >
        {/* ---- Header ---- */}
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3 shrink-0">
          {/* Circular initials avatar */}
          <div
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/20 text-sm font-bold text-[var(--accent)] select-none"
          >
            {inits}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)] leading-tight">
              {openLead.name}
            </p>
            <div className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
              {openLead.handle && <span>{openLead.handle}</span>}
              {openLead.handle && <span aria-hidden>·</span>}
              <PlatformIcon platform={openLead.platform} />
              <span className="capitalize">{openLead.platform}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail panel"
            className="ml-auto shrink-0 rounded-md p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ---- Scrollable body ---- */}
        <div ref={scrollBodyRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

          {/* Links row */}
          <div className="flex flex-wrap items-center gap-3">
            {profileUrl !== '#' ? (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`${openLead.platform} profile`}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
              >
                <ExternalLink className="size-3 shrink-0" />
                View profile
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-quaternary)] opacity-60">
                <ExternalLink className="size-3 shrink-0" />
                No profile link
              </span>
            )}

            {mailtoHref ? (
              <a
                href={mailtoHref}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
              >
                <Mail className="size-3 shrink-0" />
                {openLead.email}
              </a>
            ) : (
              // TODO: re-enable when email enrichment ships
              <span className="text-[11px] text-[var(--text-quaternary)]">—</span>
            )}
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-quaternary)]">
              Status
            </h4>
            <StatusDropdown
              value={openLead.status}
              onChange={(s) => onStatusChange(openLead, s)}
            />
          </div>

          {/* Actions row */}
          <div className="flex flex-wrap gap-2">
            {openLead.handle && (
              <button
                type="button"
                onClick={copyHandle}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]"
              >
                <Copy className="size-3" />
                {copiedHandle ? 'Copied!' : 'Copy handle'}
              </button>
            )}

            {!openLead.savedClientId && (
              <button
                type="button"
                onClick={() => setShowSaveForm((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  showSaveForm
                    ? 'border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]'
                )}
              >
                <UserPlus className="size-3" />
                Save to clients
              </button>
            )}

            {openLead.savedClientId && (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                Saved to clients
              </span>
            )}

            <button
              type="button"
              onClick={scrollToOutreach}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]"
            >
              <MessageSquare className="size-3" />
              Send outreach
            </button>
          </div>

          {/* Save to clients form */}
          {showSaveForm && !openLead.savedClientId && (
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
              <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-quaternary)]">
                Create client account
              </h4>
              <SaveForm lead={openLead} onSaved={handleSaved} />
            </div>
          )}

          {/* Why */}
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-quaternary)]">
              Why they&apos;re a fit
            </h4>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              {openLead.reason ?? '—'}
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-quaternary)]">
              Notes
            </h4>
            <textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              onBlur={handleNotesBlur}
              rows={4}
              placeholder="Add private notes about this lead…"
              className="w-full resize-none rounded-md border border-[var(--border-default)] bg-[var(--bg-app)] px-2.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-quaternary)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </div>

          {/* AI outreach */}
          <OutreachSection
            lead={openLead}
            coachContext={coachContext}
            targetRef={outreachRef}
          />
        </div>
      </aside>
    </>
  )
}
