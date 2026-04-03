'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns'
import { InvoiceCard } from '@/components/coach/InvoiceCard'
import {
  SessionBookingMessageCard,
  type SessionBookingCardData,
} from '@/components/shared/SessionBookingMessageCard'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { formatAutoCheckinMessage } from '@/lib/re-engagement-default-message'
import { cn, mergeByIdSortByCreatedAt } from '@/lib/utils'
import { BookSessionModal } from '@/app/coach/schedule/BookSessionModal'
import {
  CoachAssignmentChatCard,
  CoachAssignmentFeedbackCard,
} from '@/components/shared/AssignmentChatCards'
import {
  CoachSessionNotesMessageCard,
  parseSessionNotesPayload,
} from '@/components/shared/SessionNotesMessageCard'

/** Extra inset from bottom of layout viewport when the OS keyboard shrinks visualViewport (mobile browsers). */
function useVisualViewportKeyboardOverlap(enabled: boolean) {
  const [overlapPx, setOverlapPx] = useState(0)
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return
    }
    const vv = window.visualViewport
    if (!vv) return
    const sync = () => {
      const ih = window.innerHeight
      const visibleBottom = vv.height + vv.offsetTop
      setOverlapPx(Math.max(0, ih - visibleBottom))
    }
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [enabled])
  return enabled ? overlapPx : 0
}

type Conversation = {
  clientId: string
  fullName: string
  status: string
  lastMessagePreview: string
  lastMessageAt: string
  unreadCount: number
  /** False when no messages yet — coach can still open the thread */
  hasMessages: boolean
}

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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? ''
    const b = parts[parts.length - 1]?.[0] ?? ''
    return (a + b).toUpperCase().slice(0, 2) || '?'
  }
  return name.slice(0, 2).toUpperCase() || '?'
}

function statusBadgeVariant(status: string): 'active' | 'inactive' | 'pending' {
  if (status === 'active') return 'active'
  if (status === 'paused') return 'pending'
  return 'inactive'
}

function conversationTimeLabel(iso: string): string {
  try {
    const d = new Date(iso)
    if (isToday(d)) return format(d, 'h:mm a')
    if (isYesterday(d)) return 'Yesterday'
    return formatDistanceToNow(d, { addSuffix: true })
  } catch {
    return '—'
  }
}

function conversationTypeHint(preview: string | null | undefined): string | null {
  const p = (preview ?? '').toLowerCase()
  if (/\binvoice\b|\$\d|amount due/i.test(p)) return '📄 Invoice'
  if (/session|booked|calendar|schedule/i.test(p)) return '📅 Session'
  if (/assignment|task|submit/i.test(p)) return '📋 Assignment'
  return null
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

function MessagesThreadMessagesList({
  messages,
  userId,
  selectedClientName,
  selectedClientId,
  fetchMessages,
  onBookRequestedTime,
  onSuggestDifferentTime,
}: {
  messages: Message[]
  userId: string | null
  selectedClientName: string
  selectedClientId: string
  fetchMessages: (clientId: string) => void | Promise<void>
  onBookRequestedTime: (payload: { clientId: string; date: string | null; time: string | null }) => void
  onSuggestDifferentTime: () => void
}) {
  return (
    <div className="space-y-6">
      {groupMessagesByDate(messages).map(({ dateLabel, msgs }) => (
        <div key={dateLabel}>
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--border-subtle)]" aria-hidden />
            <span className="shrink-0 text-[11px] text-[var(--text-quaternary)]">{dateLabel}</span>
            <span className="h-px flex-1 bg-[var(--border-subtle)]" aria-hidden />
          </div>
          <div className="space-y-4">
            {msgs.map((msg) => {
              const isInvoice = msg.message_type === 'invoice'
              const isSession = msg.message_type === 'session'
              const isSessionRequest = msg.message_type === 'session_request'
              const isAssignment = msg.message_type === 'assignment'
              const isAssignmentFeedback = msg.message_type === 'assignment_feedback'
              const isTestimonialRequest = msg.message_type === 'testimonial_request'
              const isSessionNotes = msg.message_type === 'session_notes'
              let testimonialProgram: string | null = null
              if (isTestimonialRequest) {
                try {
                  const p = JSON.parse(msg.content) as { programName?: string | null }
                  testimonialProgram = p?.programName ?? null
                } catch {
                  testimonialProgram = null
                }
              }
              const sessionNotesPayload = isSessionNotes ? parseSessionNotesPayload(msg.content) : null
              let invoiceData: Parameters<typeof InvoiceCard>[0]['data'] | null = null
              let sessionData: SessionBookingCardData | null = null
              let requestData: {
                preferredDate?: string
                preferredTime?: string
                timeSlotLabel?: string | null
                sessionTypePreference?: string
                note?: string | null
              } | null = null
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
                    paymentMethod?: string | null
                    paidAt?: string | null
                  }
                  if (parsed?.type === 'invoice' && parsed.invoiceId) {
                    invoiceData = {
                      type: 'invoice',
                      invoiceId: parsed.invoiceId,
                      packageTitle: parsed.packageTitle ?? 'Invoice',
                      packageDescription: parsed.packageDescription ?? null,
                      amountCents: parsed.amountCents ?? 0,
                      currency: parsed.currency ?? 'usd',
                      status: parsed.status ?? 'pending',
                      dueDate: parsed.dueDate ?? null,
                      paymentMethod: parsed.paymentMethod ?? null,
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
              if (isSessionRequest) {
                try {
                  requestData = JSON.parse(msg.content) as {
                    preferredDate?: string
                    preferredTime?: string
                    timeSlotLabel?: string | null
                    sessionTypePreference?: string
                    note?: string | null
                  }
                } catch {
                  requestData = null
                }
              }
              return (
                <div
                  key={msg.id}
                  data-message-id={msg.id}
                  className={`flex ${msg.sender_id === userId ? 'justify-end' : 'justify-start'}`}
                >
                  {invoiceData ? (
                    <div className="max-w-[340px] rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1">
                      <InvoiceCard
                        data={invoiceData}
                        clientName={selectedClientName || 'Client'}
                        onPaymentRecorded={() => void fetchMessages(selectedClientId)}
                      />
                      <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                        {format(new Date(msg.created_at), 'h:mm a')}
                      </p>
                    </div>
                  ) : sessionData ? (
                    <div className="max-w-[340px] rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1">
                      <SessionBookingMessageCard data={sessionData} />
                      <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                        {format(new Date(msg.created_at), 'h:mm a')}
                      </p>
                    </div>
                  ) : isAssignment ? (
                    <div className="max-w-[340px] rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1">
                      <CoachAssignmentChatCard
                        content={msg.content}
                        createdAt={msg.created_at}
                        userId={userId}
                        senderId={msg.sender_id}
                        selectedClientId={selectedClientId}
                        selectedClientName={selectedClientName}
                        fetchMessages={fetchMessages}
                      />
                    </div>
                  ) : isAssignmentFeedback ? (
                    <div className="max-w-[340px] rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1">
                      <CoachAssignmentFeedbackCard
                        content={msg.content}
                        createdAt={msg.created_at}
                        sentByCoach={msg.sender_id === userId}
                      />
                    </div>
                  ) : isTestimonialRequest ? (
                    <div className="max-w-[340px] rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3.5">
                      <p className="text-[14px] font-semibold text-[var(--text-primary)]">🌟 Testimonial request</p>
                      <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">
                        {testimonialProgram
                          ? `Asking how ${testimonialProgram} went.`
                          : 'Asking for a client review.'}
                      </p>
                      <p className="mt-2 text-[12px] text-[var(--text-quaternary)]">
                        {format(new Date(msg.created_at), 'h:mm a')}
                      </p>
                    </div>
                  ) : sessionNotesPayload ? (
                    <div className="max-w-[340px] rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1">
                      <CoachSessionNotesMessageCard
                        payload={sessionNotesPayload}
                        clientName={selectedClientName || 'Client'}
                        messageCreatedAt={msg.created_at}
                      />
                      <p className="mt-1 text-[12px] text-[var(--text-quaternary)]">
                        {format(new Date(msg.created_at), 'h:mm a')}
                      </p>
                    </div>
                  ) : requestData ? (
                    <div className="max-w-[340px] rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3.5">
                      <p className="text-[14px] font-semibold text-[var(--text-primary)]">{selectedClientName} requested a session</p>
                      <p className="mt-1 text-[12px] text-[var(--accent)]">
                        {requestData.sessionTypePreference === 'in_person' ? '📍 In person' : '📹 Video session'}
                      </p>
                      <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">
                        📅 {requestData.preferredDate ?? '—'}
                        {requestData.timeSlotLabel
                          ? ` · ${requestData.timeSlotLabel}`
                          : requestData.preferredTime
                            ? ` · ${requestData.preferredTime}`
                            : ''}
                      </p>
                      {requestData.note ? <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">💬 &quot;{requestData.note}&quot;</p> : null}
                      <div className="mt-2 flex gap-2">
                        <Button
                          variant="secondary"
                          className="text-xs"
                          onClick={() => onBookRequestedTime({ clientId: selectedClientId, date: requestData?.preferredDate ?? null, time: requestData?.preferredTime ?? null })}
                        >
                          Book this time
                        </Button>
                        <Button variant="ghost" className="text-xs" onClick={onSuggestDifferentTime}>
                          Suggest different time
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'max-w-[70%] px-3.5 py-2.5 text-[14px] leading-relaxed',
                        msg.sender_id === userId
                          ? 'rounded-[12px] rounded-br-[2px] bg-[var(--accent)] text-white'
                          : 'rounded-[12px] rounded-bl-[2px] border border-[var(--border-subtle)] bg-[var(--bg-muted)] text-[var(--text-primary)]'
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <p
                        className={cn(
                          'mt-1 text-[11px]',
                          msg.sender_id === userId ? 'text-white/75' : 'text-[var(--text-quaternary)]'
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
  )
}

export function CoachMessagesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientIdFromUrl =
    searchParams.get('clientId')?.trim() || searchParams.get('client')?.trim() || null
  const messageIdFromUrl = searchParams.get('messageId')?.trim() || null

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [conversationsError, setConversationsError] = useState<string | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [selectedClientName, setSelectedClientName] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isNarrowViewport, setIsNarrowViewport] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [oldestCursor, setOldestCursor] = useState<string | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastSending, setBroadcastSending] = useState(false)
  const checkinPrefillDone = useRef(false)
  const [convSearch, setConvSearch] = useState('')
  const [convFilter, setConvFilter] = useState<'all' | 'unread' | 'invoices'>('all')
  const [bookModalOpen, setBookModalOpen] = useState(false)
  const [bookInitialDate, setBookInitialDate] = useState<string | null>(null)
  const [bookInitialTime, setBookInitialTime] = useState<string | null>(null)
  const threadScrollRef = useRef<HTMLDivElement>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const fetchConversations = useCallback(async () => {
    setConversationsError(null)
    setLoadingConversations(true)
    try {
      const res = await fetch('/api/messages/conversations')
      const json = await res.json()
      if (!res.ok) {
        setConversationsError(json.error ?? 'Could not load conversations')
        setConversations([])
        return
      }
      setConversations(json.data ?? [])
    } catch {
      setConversationsError('Something went wrong — check your connection and try again')
      setConversations([])
    } finally {
      setLoadingConversations(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    checkinPrefillDone.current = false
  }, [selectedClientId])

  useEffect(() => {
    if (searchParams.get('checkin') !== '1') return
    if (!selectedClientId || !selectedClientName.trim()) return
    if (checkinPrefillDone.current) return
    const first = selectedClientName.trim().split(/\s+/)[0] || 'there'
    setInputValue(formatAutoCheckinMessage('', first))
    checkinPrefillDone.current = true
    router.replace(`/coach/messages?clientId=${encodeURIComponent(selectedClientId)}`, { scroll: false })
  }, [searchParams, selectedClientId, selectedClientName, router])

  useEffect(() => {
    if (!clientIdFromUrl || loadingConversations) return
    setSelectedClientId(clientIdFromUrl)
    const conv = conversations.find((c) => c.clientId === clientIdFromUrl)
    if (conv?.fullName) setSelectedClientName(conv.fullName)
  }, [clientIdFromUrl, loadingConversations, conversations])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const sync = () => setIsNarrowViewport(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) setUserId(user.id)
    })
    return () => { cancelled = true }
  }, [supabase])

  const fetchMessages = useCallback(
    async (clientId: string) => {
      setMessagesError(null)
      setLoadingMessages(true)
      setHasMoreOlder(false)
      setOldestCursor(null)
      try {
        const res = await fetch(`/api/messages?clientId=${encodeURIComponent(clientId)}`)
        const json = await res.json()
        if (!res.ok) {
          setMessagesError(json.error ?? 'Could not load messages')
          setMessages([])
          return
        }
        setMessages(json.data ?? [])
        setHasMoreOlder(json.hasMore === true)
        setOldestCursor(typeof json.nextCursor === 'string' ? json.nextCursor : null)
        const conv = conversations.find((c) => c.clientId === clientId)
        if (conv?.fullName) {
          setSelectedClientName(conv.fullName)
        } else {
          const cr = await fetch(`/api/clients/${encodeURIComponent(clientId)}`)
          const cj = await cr.json().catch(() => ({}))
          if (cr.ok && cj.data) {
            const d = cj.data as {
              first_name?: string | null
              last_name?: string | null
              email?: string | null
            }
            const name = [d.first_name, d.last_name].filter(Boolean).join(' ').trim()
            setSelectedClientName(name || d.email?.trim() || 'Client')
          }
        }
      } catch {
        setMessagesError('Something went wrong — check your connection and try again')
        setMessages([])
      } finally {
        setLoadingMessages(false)
      }
    },
    [conversations]
  )

  const loadOlderMessages = useCallback(async () => {
    if (!selectedClientId || !oldestCursor || loadingOlder || !hasMoreOlder) return
    setLoadingOlder(true)
    const prevScrollHeight = threadScrollRef.current?.scrollHeight ?? 0
    try {
      const res = await fetch(
        `/api/messages?clientId=${encodeURIComponent(selectedClientId)}&before=${encodeURIComponent(oldestCursor)}`
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
  }, [selectedClientId, oldestCursor, loadingOlder, hasMoreOlder])

  useEffect(() => {
    if (!selectedClientId) {
      setMessages([])
      setMessagesError(null)
      return
    }
    fetchMessages(selectedClientId)
  }, [selectedClientId, fetchMessages])

  useEffect(() => {
    if (!messageIdFromUrl || loadingMessages) return
    if (!messages.some((m) => m.id === messageIdFromUrl)) return
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-message-id="${messageIdFromUrl}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }, [messages, messageIdFromUrl, loadingMessages])

  useEffect(() => {
    if (!selectedClientId) return
    fetch(`/api/messages/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: selectedClientId }),
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
  }, [selectedClientId])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!selectedClientId) return

    const channel = supabase
      .channel(`messages:${selectedClientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `client_id=eq.${selectedClientId}`,
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
          filter: `client_id=eq.${selectedClientId}`,
        },
        (payload) => {
          const updated = payload.new as Message
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          )
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
  }, [selectedClientId, supabase])

  const handleSend = async () => {
    const content = inputValue.trim()
    if (!content || !selectedClientId || sending) return
    setSending(true)
    setInputValue('')
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClientId, content }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMessagesError(json.error ?? 'Could not send message')
        setInputValue(content)
        return
      }
      setMessages((prev) => mergeByIdSortByCreatedAt(prev, [json.data as Message]))
      fetchConversations()
    } catch {
      setMessagesError('Could not send message — try again')
      setInputValue(content)
    } finally {
      setSending(false)
    }
  }

  const showListOnly = !selectedClientId
  const showThreadOnly = selectedClientId

  const activeClientsCount = useMemo(
    () => conversations.filter((c) => c.status === 'active').length,
    [conversations]
  )

  const totalUnread = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unreadCount > 0 ? c.unreadCount : 0), 0),
    [conversations]
  )

  const filteredConversations = useMemo(() => {
    const q = convSearch.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        (c.lastMessagePreview ?? '').toLowerCase().includes(q)
    )
  }, [conversations, convSearch])

  const displayedConversations = useMemo(() => {
    if (convFilter === 'unread') return filteredConversations.filter((c) => c.unreadCount > 0)
    if (convFilter === 'invoices') {
      return filteredConversations.filter((c) => conversationTypeHint(c.lastMessagePreview) === '📄 Invoice')
    }
    return filteredConversations
  }, [filteredConversations, convFilter])

  const keyboardOverlapPx = useVisualViewportKeyboardOverlap(
    Boolean(isNarrowViewport && selectedClientId)
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:min-h-[calc(100dvh-var(--nav-height))] lg:flex-row">
      <div
        className={`flex h-full flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-subtle)] ${
          showListOnly ? 'w-full' : 'hidden lg:flex lg:w-[320px] lg:shrink-0'
        }`}
      >
        <div className="flex min-h-11 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4 py-2">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">Messages</h1>
            {totalUnread > 0 ? (
              <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-on-accent)]">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            ) : null}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 min-h-8 shrink-0 text-[12px]"
            onClick={() => {
              setBroadcastText('')
              setBroadcastOpen(true)
            }}
          >
            Broadcast
          </Button>
        </div>
        <div className="flex shrink-0 gap-1 border-b border-[var(--border-subtle)] px-3 py-2">
          {(
            [
              ['all', 'All'] as const,
              ['unread', 'Unread'] as const,
              ['invoices', 'Invoices'] as const,
            ]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setConvFilter(key)}
              className={cn(
                'h-8 min-h-8 rounded-[var(--radius-md)] px-3 text-[12px] font-medium transition-colors duration-[80ms]',
                convFilter === key
                  ? 'bg-[var(--bg-app)] text-[var(--accent)] shadow-[var(--shadow-xs)]'
                  : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="shrink-0 px-3 py-2">
          <input
            type="search"
            placeholder="Search by name or last message…"
            value={convSearch}
            onChange={(e) => setConvSearch(e.target.value)}
            className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-app)] px-3 text-[14px] outline-none focus:border-[var(--accent)] focus:shadow-[var(--focus-ring)]"
            aria-label="Search conversations"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingConversations && <ConversationListSkeleton />}
          {!loadingConversations && conversationsError && (
            <div className="p-4">
              <p className="text-[var(--color-muted)]">{conversationsError}</p>
              <Button variant="secondary" className="mt-2" onClick={fetchConversations}>
                Try again
              </Button>
            </div>
          )}
          {!loadingConversations && !conversationsError && conversations.length === 0 && (
            <div className="p-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent-light)] text-xl" aria-hidden>
                💬
              </div>
              <p className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
                Your client conversations live here
              </p>
              <p className="mx-auto mt-2 max-w-[320px] text-[14px] font-normal leading-[1.6] text-[var(--color-muted)]">
                Add a client first — then every thread stays in one place.
              </p>
              <Link href="/coach/clients" className="mt-6 inline-block">
                <Button variant="primary" className="min-h-11">
                  View clients
                </Button>
              </Link>
            </div>
          )}
          {!loadingConversations && !conversationsError && conversations.length > 0 && (
            <ul>
              {displayedConversations.length === 0 ? (
                <li className="px-4 py-8 text-center text-[13px] text-[var(--text-tertiary)]">
                  {convFilter === 'unread'
                    ? 'You’re all caught up — no unread threads.'
                    : convFilter === 'invoices'
                      ? 'No invoice threads match. They’ll show when clients get invoice messages.'
                      : 'No conversations match your search.'}
                </li>
              ) : null}
              {displayedConversations.map((c) => {
                const unread = c.unreadCount > 0
                const hint = conversationTypeHint(c.lastMessagePreview)
                return (
                  <li key={c.clientId}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClientId(c.clientId)
                        setSelectedClientName(c.fullName)
                      }}
                      className={cn(
                        'relative flex min-h-[68px] w-full items-center gap-3 border-l-[3px] py-2.5 pl-3 pr-4 text-left transition-[background-color] duration-[80ms] hover:bg-[var(--bg-app)] focus:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--accent)]',
                        unread ? 'border-l-[var(--accent)]' : 'border-l-transparent',
                        selectedClientId === c.clientId && 'bg-[var(--bg-app)]'
                      )}
                    >
                      <div
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-light)] text-[12px] font-semibold text-[var(--accent)]',
                          unread &&
                            'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-subtle)]'
                        )}
                        aria-hidden
                      >
                        {getInitials(c.fullName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p
                            className={cn(
                              'truncate text-[14px]',
                              unread ? 'font-semibold text-[var(--text-primary)]' : 'font-normal text-[var(--text-primary)]'
                            )}
                          >
                            {c.fullName}
                          </p>
                          <span className="shrink-0 text-[11px] text-[var(--text-quaternary)]">
                            {c.lastMessageAt ? conversationTimeLabel(c.lastMessageAt) : '—'}
                          </span>
                        </div>
                        <p
                          className={cn(
                            'mt-0.5 truncate text-[12px] leading-snug',
                            unread ? 'font-medium text-[var(--text-secondary)]' : 'font-normal text-[var(--text-tertiary)]'
                          )}
                        >
                          {c.hasMessages ? c.lastMessagePreview || 'Message' : 'Start a conversation'}
                        </p>
                        {hint ? (
                          <p className="mt-1 text-[11px] text-[var(--text-quaternary)]">{hint}</p>
                        ) : null}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Right: thread — 2/3 on desktop, full on mobile when selected */}
      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--bg-app)] ${
          showThreadOnly ? 'flex w-full lg:min-w-0 lg:flex-1' : 'hidden lg:flex lg:min-w-0 lg:flex-1'
        }`}
      >
        {!selectedClientId && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="text-4xl" aria-hidden>
              💬
            </span>
            <p className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
              Your client conversations live here
            </p>
            <p className="max-w-sm text-[14px] font-normal leading-[1.6] text-[var(--color-muted)]">
              Select a client from the list or add a new client to get started.
            </p>
            <Link href="/coach/clients">
              <Button variant="primary" type="button" className="min-h-11">
                View clients
              </Button>
            </Link>
          </div>
        )}
        {selectedClientId && (
          <>
            <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] px-5">
              {isNarrowViewport && (
                <button
                  type="button"
                  onClick={() => setSelectedClientId(null)}
                  className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] text-[var(--text-primary)] shadow-[var(--shadow-xs)] hover:bg-[var(--bg-subtle)] focus-visible:shadow-[var(--focus-ring)]"
                  aria-label="Back to all conversations"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Link
                  href={`/coach/clients/${selectedClientId}`}
                  className="truncate text-[15px] font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] focus-visible:rounded focus-visible:shadow-[var(--focus-ring)]"
                >
                  {selectedClientName || 'Client'}
                </Link>
                {conversations.find((c) => c.clientId === selectedClientId) && (
                  <Badge
                    variant={statusBadgeVariant(
                      conversations.find((c) => c.clientId === selectedClientId)!.status
                    )}
                  >
                    {conversations.find((c) => c.clientId === selectedClientId)!.status}
                  </Badge>
                )}
              </div>
              <div className="hidden shrink-0 items-center gap-2 sm:flex">
                <Link
                  href={`/coach/clients/${selectedClientId}`}
                  className="rounded-[var(--radius-md)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors duration-[80ms] hover:bg-[var(--bg-muted)]"
                >
                  View profile
                </Link>
                <button
                  type="button"
                  onClick={() => setBookModalOpen(true)}
                  className="rounded-[var(--radius-md)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors duration-[80ms] hover:bg-[var(--bg-muted)]"
                >
                  Book session
                </button>
              </div>
            </div>

            <div
              ref={threadScrollRef}
              className={cn(
                'min-h-0 flex-1 overflow-y-auto p-5',
                isNarrowViewport && 'pb-40'
              )}
              onScroll={(e) => {
                const t = e.currentTarget
                if (t.scrollTop < 72 && hasMoreOlder && !loadingOlder && !loadingMessages) {
                  void loadOlderMessages()
                }
              }}
            >
              {loadingOlder && (
                <p className="mb-2 text-center text-[12px] text-[var(--color-muted)]">Loading older messages…</p>
              )}
              {loadingMessages && <ThreadSkeleton />}
              {!loadingMessages && messagesError && (
                <p className="text-[var(--color-muted)]">{messagesError}</p>
              )}
              {!loadingMessages && !messagesError && messages.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-[15px] text-[var(--color-muted)]">
                    No messages yet — type below to start the conversation.
                  </p>
                </div>
              )}
              {!loadingMessages && !messagesError && messages.length > 0 && selectedClientId && (
                <ErrorBoundary
                  fallback={
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6 text-center">
                      <p className="font-medium text-[var(--color-text-primary)]">Could not display this thread</p>
                      <p className="mt-1 text-[13px] text-[var(--color-muted)]">
                        Live updates may be unavailable. Try again or refresh the page.
                      </p>
                    </div>
                  }
                >
                  <MessagesThreadMessagesList
                    messages={messages}
                    userId={userId}
                    selectedClientName={selectedClientName}
                    selectedClientId={selectedClientId}
                    fetchMessages={fetchMessages}
                    onBookRequestedTime={({ clientId, date, time }) => {
                      setSelectedClientId(clientId)
                      setBookInitialDate(date)
                      setBookInitialTime(time)
                      setBookModalOpen(true)
                    }}
                    onSuggestDifferentTime={() => {
                      setInputValue('I can do a different time. How about tomorrow afternoon?')
                    }}
                  />
                </ErrorBoundary>
              )}
              <div ref={threadEndRef} />
            </div>

            <div
              className={cn(
                'shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-app)] px-5 py-3',
                isNarrowViewport
                  ? 'fixed left-0 right-0 z-[38] shadow-[0_-4px_24px_rgba(15,23,42,0.06)]'
                  : 'safe-bottom'
              )}
              style={
                isNarrowViewport
                  ? {
                      bottom: `calc(4.75rem + env(safe-area-inset-bottom, 0px) + ${keyboardOverlapPx}px)`,
                    }
                  : undefined
              }
            >
              <div className="flex items-end gap-2">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value.slice(0, 2000))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="Type a message..."
                  rows={1}
                  maxLength={2000}
                  className="min-h-10 max-h-[120px] flex-1 resize-none rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-[14px] leading-normal text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
                  aria-label="Message"
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!inputValue.trim() || sending}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white transition-[transform,opacity] duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:shadow-[var(--focus-ring)]"
                  aria-label="Send message"
                >
                  {sending ? (
                    <span className="text-xs">…</span>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
              {inputValue.length > 1900 && (
                <p className="mt-1 text-[var(--text-12)] text-[var(--text-tertiary)]">
                  {inputValue.length} / 2000
                </p>
              )}
            </div>
          </>
        )}
      </div>
      {toast ? (
        <div className="toast-coach" role="status">
          {toast}
        </div>
      ) : null}
      <Modal
        isOpen={broadcastOpen}
        onClose={() => !broadcastSending && setBroadcastOpen(false)}
        title="Message all clients"
        className="max-w-md"
      >
        <p className="text-[14px] text-[var(--color-muted)]">
          All {activeClientsCount} active client{activeClientsCount !== 1 ? 's' : ''} with a portal account will receive
          this message.
        </p>
        <textarea
          className="mt-4 min-h-[120px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2 text-[14px] text-[var(--text-primary)]"
          placeholder="Write your message…"
          maxLength={2000}
          value={broadcastText}
          onChange={(e) => setBroadcastText(e.target.value.slice(0, 2000))}
          aria-label="Broadcast message"
        />
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={broadcastSending} onClick={() => setBroadcastOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={broadcastSending || !broadcastText.trim()}
            onClick={async () => {
              setBroadcastSending(true)
              try {
                const res = await fetch('/api/messages/broadcast', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ content: broadcastText.trim() }),
                })
                const json = await res.json()
                if (!res.ok) {
                  setToast(json.error ?? 'Could not send broadcast')
                  return
                }
                const n = typeof json.data?.sent === 'number' ? json.data.sent : 0
                setToast(`Message sent to ${n} client${n !== 1 ? 's' : ''}`)
                setBroadcastOpen(false)
                setBroadcastText('')
                void fetchConversations()
              } catch {
                setToast('Could not send broadcast — try again')
              } finally {
                setBroadcastSending(false)
              }
            }}
          >
            {broadcastSending ? 'Sending…' : 'Send to all'}
          </Button>
        </div>
      </Modal>

      <BookSessionModal
        open={bookModalOpen}
        onClose={() => setBookModalOpen(false)}
        onBooked={() => {
          setBookModalOpen(false)
          if (selectedClientId) void fetchMessages(selectedClientId)
        }}
        initialClientId={selectedClientId}
        initialDate={bookInitialDate}
        initialTime={bookInitialTime}
      />
    </div>
  )
}

function ConversationListSkeleton() {
  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {[1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="flex min-h-[64px] items-center gap-3 px-4 py-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            <Skeleton className="h-4 w-[65%] max-w-[200px]" />
            <Skeleton className="h-3 w-[88%] max-w-[260px]" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function ThreadSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={i % 2 === 0 ? 'flex justify-end' : 'flex justify-start'}>
          <Skeleton className="h-16 w-3/4 max-w-[280px] rounded-xl" />
        </div>
      ))}
    </div>
  )
}
