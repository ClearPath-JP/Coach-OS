'use client'

import { format, isToday, isYesterday } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { InvoiceCard } from '@/components/coach/InvoiceCard'
import {
  SessionBookingMessageCard,
  type SessionBookingCardData,
} from '@/components/shared/SessionBookingMessageCard'
import {
  CoachAssignmentChatCard,
  CoachAssignmentFeedbackCard,
} from '@/components/shared/AssignmentChatCards'
import {
  CoachSessionNotesMessageCard,
  parseSessionNotesPayload,
} from '@/components/shared/SessionNotesMessageCard'

export type MessagesThreadMessage = {
  id: string
  sender_id: string
  recipient_id: string
  client_id: string
  content: string
  read_at: string | null
  created_at: string
  message_type?: string | null
}

function groupMessagesByDate(messages: MessagesThreadMessage[]): { dateLabel: string; msgs: MessagesThreadMessage[] }[] {
  const groups = new Map<string, MessagesThreadMessage[]>()
  for (const m of messages) {
    const d = new Date(m.created_at)
    const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMMM d, yyyy')
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(m)
  }
  return [...groups.entries()].map(([dateLabel, msgs]) => ({ dateLabel, msgs }))
}

export function MessagesThreadMessagesList({
  messages,
  userId,
  selectedClientName,
  selectedClientId,
  fetchMessages,
  onBookRequestedTime,
  onSuggestDifferentTime,
}: {
  messages: MessagesThreadMessage[]
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
          <div>
            {msgs.map((msg, i) => {
              const prev = msgs[i - 1]
              const sameSender = prev && prev.sender_id === msg.sender_id
              const gapTop = i === 0 ? 0 : sameSender ? 2 : 6
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
                  style={{ marginTop: gapTop }}
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
                      <p
                        className={'mt-1 text-[12px] text-[var(--accent)]' /* cp-accent-ok: follows coach theme */}
                      >
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
                          onClick={() =>
                            onBookRequestedTime({
                              clientId: selectedClientId,
                              date: requestData?.preferredDate ?? null,
                              time: requestData?.preferredTime ?? null,
                            })
                          }
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
                          ? 'rounded-[12px] rounded-br-[2px] bg-[var(--cp-sapphire)] text-white'
                          : 'rounded-[12px] rounded-bl-[2px] border-none bg-[var(--cp-white)] text-[var(--cp-navy)]'
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
