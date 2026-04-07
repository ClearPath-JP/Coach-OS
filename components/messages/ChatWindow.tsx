'use client'

import { useEffect, useRef, useState } from 'react'
import type { MessagesUIChatMessage, MessagesUIConversation } from '@/types/messages-ui'

export interface ChatWindowProps {
  conversation: MessagesUIConversation | null
  messages: MessagesUIChatMessage[]
  currentUserId: string
  currentUserRole: 'coach' | 'student'
  onSend: (text: string) => Promise<void>
  isSending: boolean
  /** Rich thread (invoices, sessions, etc.) — replaces default text bubbles */
  threadContent?: React.ReactNode
  /** Replace default composer (e.g. to preserve existing controlled input) */
  composeSlot?: React.ReactNode
  /** Extra controls in the header row (badges, links) */
  headerExtras?: React.ReactNode
  showBackButton?: boolean
  onBack?: () => void
  /** Scroll container ref for infinite scroll / keyboard handling */
  threadScrollRef?: React.RefObject<HTMLDivElement | null>
  threadEndRef?: React.RefObject<HTMLDivElement | null>
  onThreadScroll?: React.UIEventHandler<HTMLDivElement>
  threadScrollClassName?: string
}

export function ChatWindow({
  conversation,
  messages,
  currentUserId,
  onSend,
  isSending,
  threadContent,
  composeSlot,
  headerExtras,
  showBackButton,
  onBack,
  threadScrollRef,
  threadEndRef,
  onThreadScroll,
  threadScrollClassName,
}: ChatWindowProps) {
  const [draft, setDraft] = useState('')
  const internalScrollRef = useRef<HTMLDivElement>(null)
  const internalEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = threadScrollRef ?? internalScrollRef
  const endRef = threadEndRef ?? internalEndRef

  useEffect(() => {
    if (threadContent) return
    internalEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, threadContent])

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  const handleSend = async () => {
    const text = draft.trim()
    if (!text || isSending) return
    setDraft('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    await onSend(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  function messageTimeMs(m: (typeof messages)[number]): number {
    if (m.sentAt) {
      const t = new Date(m.sentAt).getTime()
      if (Number.isFinite(t)) return t
    }
    const parsed = Date.parse(m.timestamp)
    return Number.isFinite(parsed) ? parsed : NaN
  }

  if (!conversation) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--cp-offwhite)',
          gap: 12,
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'var(--cp-lavender)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="22"
            height="22"
            fill="none"
            stroke="var(--cp-sapphire)"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--cp-navy)', margin: 0 }}>
          No conversation selected
        </p>
        <p
          style={{
            fontSize: 12,
            color: 'var(--cp-gray)',
            textAlign: 'center',
            maxWidth: 240,
            margin: 0,
          }}
        >
          Pick someone from the list to start.
        </p>
      </div>
    )
  }

  const initials = conversation.participantName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <>
      <style>{`
        @keyframes cp-spin { to { transform: rotate(360deg); } }
      `}</style>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--cp-offwhite)',
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--cp-border)',
            background: 'var(--bg-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          {showBackButton ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to conversations"
              style={{
                display: 'flex',
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                border: '1px solid var(--cp-border)',
                background: 'var(--bg-subtle)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--cp-navy)"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          ) : null}
          <div style={{ position: 'relative' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background:
                  conversation.participantRole === 'coach'
                    ? 'var(--cp-sapphire)'
                    : 'var(--cp-royal)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: '#FFFFFF',
              }}
            >
              {initials}
            </div>
            {conversation.isOnline ? (
              <div
                style={{
                  position: 'absolute',
                  bottom: 1,
                  right: 1,
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: '#22C55E',
                  border: '2px solid var(--cp-white)',
                }}
              />
            ) : null}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--cp-navy)' }}>
              {conversation.participantName}
            </div>
            {conversation.isOnline ? (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--cp-gray)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 2,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#22C55E',
                    flexShrink: 0,
                  }}
                  aria-hidden
                />
                Online
              </div>
            ) : null}
          </div>
          {headerExtras ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{headerExtras}</div>
          ) : null}
        </div>

        <div
          ref={scrollRef}
          className={threadScrollClassName}
          onScroll={onThreadScroll}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            minHeight: 0,
          }}
        >
          {threadContent ??
            messages.map((msg, i) => {
              const isMe = msg.senderId === currentUserId
              const prev = messages[i - 1]
              const curMs = messageTimeMs(msg)
              const prevMs = prev ? messageTimeMs(prev) : NaN
              const gap30 =
                i > 0 && Number.isFinite(curMs) && Number.isFinite(prevMs) && curMs - prevMs > 30 * 60 * 1000
              const showTime = i === 0 || messages[i - 1]?.senderId !== msg.senderId || gap30

              return (
                <div key={msg.id}>
                  {showTime ? (
                    <div
                      style={{
                        textAlign: 'center',
                        fontSize: 11,
                        color: 'var(--cp-gray)',
                        margin: '8px 0 4px',
                      }}
                    >
                      {msg.timestamp}
                    </div>
                  ) : null}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      marginBottom: 2,
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '68%',
                        padding: '12px 14px',
                        borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: isMe ? 'var(--accent)' : 'var(--bg-muted)',
                        color: isMe ? 'var(--text-on-accent)' : 'var(--text-primary)',
                        fontSize: 14,
                        lineHeight: 1.45,
                        border: isMe ? 'none' : '1px solid var(--border-default)',
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                  {isMe && i === messages.length - 1 && msg.status ? (
                    <div
                      style={{
                        textAlign: 'right',
                        fontSize: 11,
                        color: 'var(--cp-gray)',
                        marginTop: 2,
                        paddingRight: 2,
                      }}
                    >
                      {msg.status === 'read' ? 'Read' : msg.status === 'delivered' ? '✓✓' : '✓'}
                    </div>
                  ) : null}
                </div>
              )
            })}
          <div ref={endRef} />
        </div>

        {composeSlot ?? (
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--cp-border)',
              background: 'var(--bg-subtle)',
              display: 'flex',
              alignItems: 'flex-end',
              gap: 10,
              flexShrink: 0,
            }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Message"
              value={draft}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              style={{
                flex: 1,
                resize: 'none',
                border: '1.5px solid var(--cp-border)',
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 14,
                color: 'var(--cp-navy)',
                background: 'var(--cp-offwhite)',
                outline: 'none',
                lineHeight: 1.45,
                fontFamily: 'inherit',
                minHeight: 40,
                maxHeight: 120,
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--cp-input-focus)'
                e.target.style.background = 'var(--cp-white)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--cp-border)'
                e.target.style.background = 'var(--cp-offwhite)'
              }}
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!draft.trim() || isSending}
              aria-label="Send message"
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                border: 'none',
                background: draft.trim() && !isSending ? 'var(--cp-sapphire)' : 'var(--cp-border)',
                color: '#FFFFFF',
                cursor: draft.trim() && !isSending ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.15s, transform 0.1s',
              }}
              onMouseEnter={(e) => {
                if (draft.trim() && !isSending)
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
              }}
            >
              {isSending ? (
                <div
                  style={{
                    width: 14,
                    height: 14,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#FFFFFF',
                    borderRadius: '50%',
                    animation: 'cp-spin 0.7s linear infinite',
                  }}
                />
              ) : (
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
