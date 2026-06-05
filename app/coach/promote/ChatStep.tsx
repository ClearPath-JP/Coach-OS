'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Send, Loader2, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type ChatMsg, type PromoteResult, type Post, type BrandVoice, type DoneMeta } from './promote-shared'

const GREETING =
  'Tell me what’s on your mind — a technique you love, a student win, why you coach, or what you want to say this week. I’ll ask a couple of questions, then turn it into a post that sounds like you.'

const STARTERS = [
  'I taught a student to escape side control today and it finally clicked.',
  'Why I started coaching out of my garage.',
  '3 things every beginner gets wrong in their first month.',
]

type ChatResponse = { data?: { kind: 'reply'; reply: string } | { kind: 'post'; post: Post }; error?: string }

export function ChatStep({
  voice,
  onDone,
}: {
  voice: BrandVoice
  onDone: (r: PromoteResult, meta?: DoneMeta) => void
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const busy = sending || finalizing

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, sending])

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    setError(null)
    const next: ChatMsg[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/coach/promote/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: next,
          discipline: voice.discipline || undefined,
          tone: voice.tone,
          platform: voice.platform,
          bookingUrl: voice.bookingUrl || undefined,
          signature: voice.signature || undefined,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as ChatResponse
      if (!res.ok) {
        setError(json.error ?? 'Could not respond — try again')
        return
      }
      const data = json.data
      if (data?.kind === 'reply') setMessages((m) => [...m, { role: 'assistant', content: data.reply }])
    } catch {
      setError('Network error — please try again')
    } finally {
      setSending(false)
    }
  }

  async function createPost() {
    if (busy || !messages.some((m) => m.role === 'user')) return
    setError(null)
    setFinalizing(true)
    try {
      const res = await fetch('/api/coach/promote/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages,
          discipline: voice.discipline || undefined,
          tone: voice.tone,
          platform: voice.platform,
          bookingUrl: voice.bookingUrl || undefined,
          signature: voice.signature || undefined,
          finalize: true,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as ChatResponse
      if (!res.ok) {
        setError(json.error ?? 'Could not create the post — try again')
        return
      }
      const data = json.data
      if (data?.kind === 'post') onDone({ type: 'post', post: data.post })
    } catch {
      setError('Network error — please try again')
    } finally {
      setFinalizing(false)
    }
  }

  const canCreate = messages.some((m) => m.role === 'user') && !busy

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
      <div className="h-[40vh] min-h-[260px] space-y-3 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] p-4">
        <Bubble role="assistant">{GREETING}</Bubble>
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5 pl-1 pt-1">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInput(s)}
                className="rounded-full border border-[var(--border-default)] px-2.5 py-1 text-left text-[11px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]"
              >
                {s.length > 44 ? `${s.slice(0, 42)}…` : s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role}>
            {m.content}
          </Bubble>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-quaternary)]">
            <Loader2 className="size-3.5 animate-spin" /> thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
        className="flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your thought…"
          disabled={busy}
          maxLength={2000}
          className="min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="inline-flex items-center justify-center rounded-lg border border-[var(--border-default)] p-2.5 text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Send"
        >
          <Send className="size-4" />
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
        <p className="text-[11px] text-[var(--text-quaternary)]">Chat as long as you like — then turn it into a post.</p>
        <button
          type="button"
          onClick={createPost}
          disabled={!canCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--text-on-accent)] shadow-sm transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {finalizing ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          Create the post
        </button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-[var(--error)]">
          {error}
        </p>
      )}
    </div>
  )
}

function Bubble({ role, children }: { role: 'user' | 'assistant'; children: ReactNode }) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
          isUser ? 'bg-[var(--accent)] text-[var(--text-on-accent)]' : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]'
        )}
      >
        {children}
      </div>
    </div>
  )
}
