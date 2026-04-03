/* TODO Phase 6: virtualize list if coaches have > 50 students */
'use client'

import { memo, useCallback, useMemo, useState } from 'react'
import type { MessagesUIConversation } from '@/types/messages-ui'

const INITIAL_LIMIT = 100

const ConversationSidebarRow = memo(function ConversationSidebarRow({
  convo,
  activeId,
  onActivate,
}: {
  convo: MessagesUIConversation
  activeId: string | null
  onActivate: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onActivate(convo.id)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        border: 'none',
        borderBottom: '1px solid var(--cp-border)',
        borderLeft: activeId === convo.id ? '3px solid var(--cp-accent)' : '3px solid transparent',
        background: activeId === convo.id ? 'var(--cp-offwhite)' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.1s',
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => {
        if (activeId !== convo.id) (e.currentTarget as HTMLButtonElement).style.background = 'var(--cp-offwhite)'
      }}
      onMouseLeave={(e) => {
        if (activeId !== convo.id) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: convo.participantRole === 'coach' ? 'var(--cp-sapphire)' : 'var(--cp-royal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            color: '#FFFFFF',
          }}
        >
          {convo.participantAvatar ??
            convo.participantName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
        </div>
        {convo.isOnline ? (
          <div
            style={{
              position: 'absolute',
              bottom: 1,
              right: 1,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#22C55E',
              border: '2px solid var(--cp-white)',
            }}
          />
        ) : null}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: convo.unreadCount > 0 ? 700 : 500,
              color: 'var(--cp-navy)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {convo.participantName}
          </span>
          <span style={{ fontSize: 11, color: 'var(--cp-gray)', flexShrink: 0 }}>
            {convo.lastMessageTime}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 16,
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 12,
              color: convo.unreadCount > 0 ? 'var(--cp-navy)' : 'var(--cp-gray)',
              fontWeight: convo.unreadCount > 0 ? 600 : 400,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {convo.lastMessage}
          </span>
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          alignSelf: 'stretch',
          minWidth: convo.unreadCount > 0 ? 22 : 0,
          justifyContent: 'flex-end',
        }}
      >
        {convo.unreadCount > 0 ? (
          <div
            style={{
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: 'var(--cp-sapphire)',
              color: '#FFFFFF',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {convo.unreadCount > 99 ? '99+' : convo.unreadCount}
          </div>
        ) : null}
      </div>
    </button>
  )
})

export interface ConversationSidebarProps {
  conversations: MessagesUIConversation[]
  activeId: string | null
  onSelect: (id: string) => void
  currentUserRole: 'coach' | 'student'
  searchQuery: string
  onSearchChange: (q: string) => void
  /** Coach tools (e.g. Broadcast) */
  headerActions?: React.ReactNode
  /** Filters or secondary controls below the title row */
  belowHeader?: React.ReactNode
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  emptyState?: React.ReactNode
  loadingContent?: React.ReactNode
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  searchQuery,
  onSearchChange,
  headerActions,
  belowHeader,
  loading,
  error,
  onRetry,
  emptyState,
  loadingContent,
}: ConversationSidebarProps) {
  const [limit, setLimit] = useState(INITIAL_LIMIT)
  const q = searchQuery.toLowerCase()
  const filtered = useMemo(
    () =>
      conversations.filter(
        (c) =>
          c.participantName.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q)
      ),
    [conversations, q]
  )
  const visible = filtered.slice(0, limit)
  const selectConversation = useCallback((id: string) => onSelect(id), [onSelect])

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        borderRight: '1px solid var(--cp-border)',
        background: 'var(--cp-white)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div
        style={{
          padding: '20px 16px 12px',
          borderBottom: '1px solid var(--cp-border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: belowHeader ? 10 : 12,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--cp-gray)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Messages
          </span>
          {headerActions}
        </div>

        {belowHeader}

        <div style={{ position: 'relative', marginTop: belowHeader ? 10 : 0 }}>
          <svg
            width="15"
            height="15"
            fill="none"
            stroke="var(--cp-gray)"
            strokeWidth="2"
            viewBox="0 0 24 24"
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
            }}
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              height: 32,
              border: '1.5px solid transparent',
              borderRadius: 8,
              paddingLeft: 32,
              paddingRight: 12,
              fontSize: 13,
              color: 'var(--cp-navy)',
              background: 'var(--cp-offwhite)',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--cp-input-focus)'
              e.target.style.background = 'var(--cp-white)'
              e.target.style.boxShadow = '0 0 0 2px var(--cp-focus-ring)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'transparent'
              e.target.style.background = 'var(--cp-offwhite)'
              e.target.style.boxShadow = 'none'
            }}
            aria-label="Search conversations"
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading ? (
          loadingContent ?? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                color: 'var(--cp-gray)',
                fontSize: 13,
              }}
            >
              Loading…
            </div>
          )
        ) : error ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <p style={{ color: 'var(--cp-gray)', fontSize: 13, margin: '0 0 12px' }}>{error}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                style={{
                  border: '1px solid var(--cp-border)',
                  background: 'var(--cp-white)',
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontSize: 13,
                  color: 'var(--cp-navy)',
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : filtered.length === 0 ? (
          emptyState ?? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                color: 'var(--cp-gray)',
                fontSize: 13,
              }}
            >
              No conversations found.
            </div>
          )
        ) : (
          <>
            {visible.map((convo) => (
              <ConversationSidebarRow
                key={convo.id}
                convo={convo}
                activeId={activeId}
                onActivate={selectConversation}
              />
            ))}
            {filtered.length > limit ? (
              <button
                type="button"
                onClick={() => setLimit((l) => l + 100)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'none',
                  border: 'none',
                  borderTop: '1px solid var(--cp-border)',
                  fontSize: 13,
                  color: 'var(--cp-accent)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Load more ({filtered.length - limit} remaining)
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
