'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { format, isToday, isYesterday } from 'date-fns'
import { InvoiceCardClient } from '@/components/client/InvoiceCardClient'
import {
  SessionBookingMessageCard,
  type SessionBookingCardData,
} from '@/components/shared/SessionBookingMessageCard'
import { cn, mergeByIdSortByCreatedAt } from '@/lib/utils'
import { ConversationSidebar } from '@/components/messages/ConversationSidebar'
import { ChatWindow } from '@/components/messages/ChatWindow'
import type { MessagesUIConversation } from '@/types/messages-ui'
import { formatConversationListTime } from '@/lib/conversation-time'
import {
  ClientAssignmentChatCard,
  ClientAssignmentFeedbackCard,
} from '@/components/shared/AssignmentChatCards'
import { TestimonialRequestCard } from '@/components/client/TestimonialRequestCard'
import {
  ClientSessionNotesMessageCard,
  parseSessionNotesPayload,
} from '@/components/shared/SessionNotesMessageCard'

type Message = {
  id: string
  sender_id: string
  recipient_id: string
  client_id: string
  content: string
  read_at: string | null
  created_at: string
  message_type?: string | null
}

type WorkspaceBrandingPayments = {
  stripeConnected: boolean
  stripeCardPaymentsEnabled: boolean
  cashappUsername: string | null
  venmoUsername: string | null
  paypalEmail: string | null
  zelleEmailOrPhone: string | null
  paymentInstructions: string | null
}

export function ClientMessagesContent({
  clientId,
  coachName,
}: {
  clientId: string
  coachName: string
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [oldestCursor, setOldestCursor] = useState<string | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [paymentDetails, setPaymentDetails] = useState<WorkspaceBrandingPayments | null>(null)
  const searchParams = useSearchParams()
  const focusMessageId = searchParams.get('messageId')?.trim() || null
  const threadScrollRef = useRef<HTMLDivElement>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const [convSearch, setConvSearch] = useState('')
  const [isNarrowViewport, setIsNarrowViewport] = useState(false)
  const [mobileShowChat, setMobileShowChat] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const sync = () => setIsNarrowViewport(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const fetchMessages = useCallback(async () => {
    setError(null)
    setLoading(true)
    setHasMoreOlder(false)
    setOldestCursor(null)
    try {
      const res = await fetch(`/api/messages?clientId=${encodeURIComponent(clientId)}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load messages')
        setMessages([])
        return
      }
      setMessages(json.data ?? [])
      setHasMoreOlder(json.hasMore === true)
      setOldestCursor(typeof json.nextCursor === 'string' ? json.nextCursor : null)
    } catch {
      setError('Something went wrong — check your connection and try again')
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [clientId])

  const loadOlderMessages = useCallback(async () => {
    if (!oldestCursor || loadingOlder || !hasMoreOlder || loading) return
    setLoadingOlder(true)
    const prevScrollHeight = threadScrollRef.current?.scrollHeight ?? 0
    try {
      const res = await fetch(
        `/api/messages?clientId=${encodeURIComponent(clientId)}&before=${encodeURIComponent(oldestCursor)}`
      )
      const json = await res.json()
      if (!res.ok || !json.data?.length) {
        setHasMoreOlder(false)
        return
      }
      setMessages((prev) =>
        mergeByIdSortByCreatedAt(prev, json.data as Message[])
      )
      setHasMoreOlder(json.hasMore === true)
      setOldestCursor(typeof json.nextCursor === 'string' ? json.nextCursor : null)
    } catch {
      setHasMoreOlder(false)
    } finally {
      setLoadingOlder(false)
      requestAnimationFrame(() => {
        const el = threadScrollRef.current
        if (el) el.scrollTop = el.scrollHeight - prevScrollHeight
      })
    }
  }, [clientId, oldestCursor, loadingOlder, hasMoreOlder, loading])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  const loadWorkspaceBrandingPayments = useCallback(() => {
    fetch('/api/client/workspace-branding', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json?.data) return
        setPaymentDetails({
          stripeConnected: json.data.stripeConnected ?? false,
          stripeCardPaymentsEnabled: json.data.stripeCardPaymentsEnabled ?? false,
          cashappUsername: json.data.cashappUsername ?? null,
          venmoUsername: json.data.venmoUsername ?? null,
          paypalEmail: json.data.paypalEmail ?? null,
          zelleEmailOrPhone: json.data.zelleEmailOrPhone ?? null,
          paymentInstructions: json.data.paymentInstructions ?? null,
        })
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    loadWorkspaceBrandingPayments()
    const interval = window.setInterval(loadWorkspaceBrandingPayments, 60_000)
    const onFocus = () => loadWorkspaceBrandingPayments()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [loadWorkspaceBrandingPayments])

  useEffect(() => {
    fetch(`/api/messages/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          let body: { error?: string } = {}
          try {
            body = await res.json()
          } catch {
            /* ignore */
          }
          console.error('Mark messages read failed:', res.status, body)
          setToast('Could not mark messages as read — try again')
        }
      })
      .catch((err) => {
        console.error('Mark messages read failed:', err)
        setToast('Could not mark messages as read — try again')
      })
  }, [clientId])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) setUserId(user.id)
    })
    return () => { cancelled = true }
  }, [supabase])

  useEffect(() => {
    if (focusMessageId && messages.some((m) => m.id === focusMessageId)) {
      const el = document.querySelector(`[data-message-id="${focusMessageId}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, focusMessageId])

  useEffect(() => {
    if (!clientId) return

    const channel = supabase
      .channel(`client-messages:${clientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const msg = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const updated = payload.new as Message
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [clientId, supabase])

  const handleSend = async () => {
    const content = inputValue.trim()
    if (!content || sending) return
    setSending(true)
    setInputValue('')
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, content }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not send message')
        setInputValue(content)
        return
      }
      setMessages((prev) => mergeByIdSortByCreatedAt(prev, [json.data as Message]))
      window.dispatchEvent(new CustomEvent('clearpath:unread-messages-updated'))
    } catch {
      setError('Could not send message — try again')
      setInputValue(content)
    } finally {
      setSending(false)
    }
  }

  const coachSidebarModel = useMemo((): MessagesUIConversation => {
    const last = messages[messages.length - 1]
    let lastMessage = 'Start the conversation'
    let lastMessageTime = '—'
    if (last) {
      if (last.message_type === 'invoice') lastMessage = 'Invoice'
      else if (last.message_type === 'session') lastMessage = 'Session'
      else {
        const t = last.content || 'Message'
        lastMessage = t.length > 90 ? `${t.slice(0, 90)}…` : t
      }
      lastMessageTime = formatConversationListTime(last.created_at)
    }
    return {
      id: clientId,
      participantName: coachName,
      participantRole: 'coach',
      lastMessage,
      lastMessageTime,
      unreadCount: 0,
    }
  }, [clientId, coachName, messages])

  const threadBody = (
    <>
      {loadingOlder && (
        <p className="mb-2 text-center text-[12px] text-[var(--color-muted)]">Loading older messages…</p>
      )}
      {loading && <ThreadSkeleton />}
      {!loading && error && <p className="text-[var(--color-muted)]">{error}</p>}
      {!loading && !error && messages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="font-medium" style={{ color: 'var(--cp-navy)' }}>
            No messages yet.
          </p>
          <p className="mt-1 text-[15px] text-[var(--color-muted)]">Send your coach a message to get started.</p>
        </div>
      )}
      {!loading && !error && messages.length > 0 && (
        <div className="space-y-4">
          {groupMessagesByDate(messages).map(({ dateLabel, msgs }) => (
            <div key={dateLabel}>
              <p className="mb-2 text-center text-[12px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                {dateLabel}
              </p>
              <div className="space-y-2">
                {msgs.map((msg) => {
                  const isInvoice = msg.message_type === 'invoice'
                  const isSession = msg.message_type === 'session'
                  const isAssignment = msg.message_type === 'assignment'
                  const isAssignmentFeedback = msg.message_type === 'assignment_feedback'
                  const isTestimonialRequest = msg.message_type === 'testimonial_request'
                  const isSessionNotes = msg.message_type === 'session_notes'
                  const sessionNotesPayload = isSessionNotes ? parseSessionNotesPayload(msg.content) : null
                  let invoiceData: Parameters<typeof InvoiceCardClient>[0]['data'] | null = null
                  let sessionData: SessionBookingCardData | null = null
                  if (isInvoice) {
                    try {
                      const parsed = JSON.parse(msg.content) as {
                        type?: string
                        invoiceId?: string
                        packageTitle?: string
                        packageDescription?: string | null
                        amountCents?: number
                        currency?: string
                        status?: string
                        dueDate?: string | null
                        paidAt?: string | null
                      }
                      if (parsed?.type === 'invoice' && parsed.invoiceId) {
                        invoiceData = {
                          type: 'invoice',
                          invoiceId: parsed.invoiceId,
                          clientId: msg.client_id,
                          packageTitle: parsed.packageTitle ?? 'Invoice',
                          packageDescription: parsed.packageDescription ?? null,
                          amountCents: parsed.amountCents ?? 0,
                          currency: parsed.currency ?? 'usd',
                          status: parsed.status ?? 'pending',
                          dueDate: parsed.dueDate ?? null,
                          paidAt: parsed.paidAt ?? null,
                        }
                      }
                    } catch {
                      invoiceData = null
                    }
                  }
                  if (isSession) {
                    try {
                      const parsed = JSON.parse(msg.content) as {
                        type?: string
                        sessionId?: string
                        scheduledTime?: string
                        endTime?: string | null
                        durationMinutes?: number
                        status?: string
                        notes?: string | null
                      }
                      if (parsed?.type === 'session' && parsed.sessionId && parsed.scheduledTime) {
                        sessionData = {
                          type: 'session',
                          sessionId: parsed.sessionId,
                          scheduledTime: parsed.scheduledTime,
                          endTime: parsed.endTime ?? null,
                          durationMinutes: parsed.durationMinutes ?? 60,
                          status: parsed.status ?? 'confirmed',
                          notes: parsed.notes ?? null,
                        }
                      }
                    } catch {
                      sessionData = null
                    }
                  }
                  return (
                    <div
                      key={msg.id}
                      data-message-id={msg.id}
                      className={`flex ${msg.sender_id === userId ? 'justify-end' : 'justify-start'}`}
                    >
                      {invoiceData ? (
                        <div className="max-w-[320px]">
                          <InvoiceCardClient data={invoiceData} paymentDetails={paymentDetails ?? {}} />
                          <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                            {format(new Date(msg.created_at), 'h:mm a')}
                          </p>
                        </div>
                      ) : sessionData ? (
                        <div className="max-w-[320px]">
                          <SessionBookingMessageCard data={sessionData} />
                          <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                            {format(new Date(msg.created_at), 'h:mm a')}
                          </p>
                        </div>
                      ) : isAssignment ? (
                        <div className="max-w-[320px]">
                          <ClientAssignmentChatCard
                            content={msg.content}
                            createdAt={msg.created_at}
                            userId={userId}
                            senderId={msg.sender_id}
                            fetchMessages={fetchMessages}
                          />
                        </div>
                      ) : isAssignmentFeedback ? (
                        <div className="max-w-[320px]">
                          <ClientAssignmentFeedbackCard content={msg.content} createdAt={msg.created_at} />
                        </div>
                      ) : isTestimonialRequest ? (
                        <div className="max-w-[320px]">
                          <TestimonialRequestCard
                            content={msg.content}
                            createdAt={msg.created_at}
                            coachName={coachName}
                            onSubmitted={() => void fetchMessages()}
                          />
                        </div>
                      ) : sessionNotesPayload ? (
                        <div className="max-w-[360px]">
                          <ClientSessionNotesMessageCard
                            payload={sessionNotesPayload}
                            coachName={coachName}
                            onActionUpdated={() => void fetchMessages()}
                          />
                          <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                            {format(new Date(msg.created_at), 'h:mm a')}
                          </p>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            'max-w-[85%] rounded-xl px-4 py-2',
                            msg.sender_id === userId
                              ? 'text-white'
                              : 'border border-[var(--cp-border)] bg-[var(--cp-white)] text-[var(--cp-navy)]'
                          )}
                          style={msg.sender_id === userId ? { background: 'var(--cp-sapphire)' } : undefined}
                        >
                          <p className="whitespace-pre-wrap break-words text-[15px]">{msg.content}</p>
                          <p
                            className={cn(
                              'mt-1 text-[12px]',
                              msg.sender_id === userId ? 'text-white/80' : 'text-[var(--color-muted)]'
                            )}
                          >
                            {format(new Date(msg.created_at), 'h:mm a')}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )

  const composeSlot = (
    <div
      className="safe-bottom shrink-0 border-t border-[var(--cp-border)] bg-[var(--cp-white)] px-4 py-3 lg:px-5"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-end gap-2">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value.slice(0, 2000))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
          placeholder="Message"
          rows={1}
          maxLength={2000}
          className="min-h-[40px] max-h-[120px] flex-1 resize-none rounded-xl border border-[var(--cp-border)] bg-[var(--cp-offwhite)] px-4 py-2.5 text-[15px] placeholder:text-[var(--color-muted)] focus:border-[var(--cp-input-focus)] focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
          style={{ color: 'var(--cp-navy)' }}
          aria-label="Message"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!inputValue.trim() || sending}
          aria-label="Send message"
          className="flex size-[38px] shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'var(--cp-sapphire)' }}
        >
          {sending ? (
            <span
              className="inline-block size-4 rounded-full border-2 border-white/30 border-t-white"
              style={{ animation: 'cp-spin 0.7s linear infinite' }}
            />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
      {inputValue.length > 1900 && (
        <p className="mt-1 text-[12px] text-[var(--color-muted)]">{inputValue.length} / 2000</p>
      )}
    </div>
  )

  const shellHeight =
    isNarrowViewport ? 'calc(100dvh - var(--nav-height) - 5.5rem)' : 'calc(100dvh - var(--nav-height))'

  return (
    <>
      <style>{`
        @keyframes cp-spin { to { transform: rotate(360deg); } }
      `}</style>
      <div
        className="flex min-h-0 w-full flex-1 overflow-hidden"
        style={{
          height: shellHeight,
          maxHeight: shellHeight,
          background: 'var(--cp-offwhite)',
        }}
      >
        <div
          className={cn(
            'min-h-0 h-full min-w-0 shrink-0',
            isNarrowViewport && mobileShowChat ? 'hidden' : 'flex',
            !isNarrowViewport && 'flex'
          )}
        >
          <ConversationSidebar
            conversations={[coachSidebarModel]}
            activeId={clientId}
            onSelect={() => setMobileShowChat(true)}
            currentUserRole="student"
            searchQuery={convSearch}
            onSearchChange={setConvSearch}
            loading={false}
            error={null}
          />
        </div>

        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            isNarrowViewport && !mobileShowChat && 'hidden',
            !isNarrowViewport && 'flex'
          )}
        >
          <ChatWindow
            conversation={coachSidebarModel}
            messages={[]}
            currentUserId={userId ?? ''}
            currentUserRole="student"
            onSend={async () => {}}
            isSending={false}
            threadContent={threadBody}
            composeSlot={composeSlot}
            showBackButton={isNarrowViewport}
            onBack={() => setMobileShowChat(false)}
            threadScrollRef={threadScrollRef}
            threadEndRef={threadEndRef}
            onThreadScroll={(e) => {
              const t = e.currentTarget
              if (t.scrollTop < 72 && hasMoreOlder && !loadingOlder && !loading) {
                void loadOlderMessages()
              }
            }}
            threadScrollClassName={cn(isNarrowViewport && 'pb-4')}
            headerExtras={
              <Link
                href="/client/portal"
                className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
              >
                Portal
              </Link>
            }
          />
        </div>
      </div>
      {toast ? (
        <div
          className="fixed bottom-24 left-1/2 z-[60] max-w-sm -translate-x-1/2 rounded-lg border border-[var(--color-border)] bg-[var(--color-ink)] px-4 py-2 text-center text-[14px] text-white shadow-lg lg:bottom-6"
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </>
  )
}

function groupMessagesByDate(messages: Message[]): { dateLabel: string; msgs: Message[] }[] {
  const groups = new Map<string, Message[]>()
  for (const m of messages) {
    const d = new Date(m.created_at)
    const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMMM d, yyyy')
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(m)
  }
  return [...groups.entries()].map(([dateLabel, msgs]) => ({ dateLabel, msgs }))
}

function ThreadSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={i % 2 === 0 ? 'flex justify-end' : 'flex justify-start'}>
          <div className="h-16 w-3/4 max-w-[280px] rounded-xl bg-[var(--color-border)] animate-pulse" />
        </div>
      ))}
    </div>
  )
}
