'use client'

import { useEffect, useState } from 'react'
import { Megaphone, ArrowLeft, RotateCcw, Dumbbell } from 'lucide-react'
import {
  StepProgress,
  ToneToggle,
  PostCard,
  VideoPlanCard,
  ResultActions,
  fullCaption,
  videoPlanCaption,
  type Path,
  type Tone,
  type PromoteResult,
} from './promote-shared'
import { PathStep } from './PathStep'
import { IdeaStep } from './IdeaStep'
import { ChatStep } from './ChatStep'
import { VideoStep } from './VideoStep'

const FORM_KEY = 'kindo-promote-form'
const LEADS_KEY = 'kindo-leads-form'

export function PromotePageContent() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [path, setPath] = useState<Path | null>(null)
  const [discipline, setDiscipline] = useState('')
  const [tone, setTone] = useState<Tone>('friendly')
  const [result, setResult] = useState<PromoteResult | null>(null)

  // Restore discipline + tone; fall back to whatever the coach typed in Lead research.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FORM_KEY)
      if (raw) {
        const v = JSON.parse(raw) as Partial<{ discipline: string; tone: Tone }>
        if (typeof v.discipline === 'string') setDiscipline(v.discipline)
        if (v.tone === 'hype' || v.tone === 'calm' || v.tone === 'friendly') setTone(v.tone)
      } else {
        const lr = localStorage.getItem(LEADS_KEY)
        if (lr) {
          const lv = JSON.parse(lr) as Partial<{ discipline: string }>
          if (typeof lv.discipline === 'string') setDiscipline(lv.discipline)
        }
      }
    } catch {
      /* ignore malformed cache */
    }
  }, [])

  function persist(d: string, t: Tone) {
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify({ discipline: d.trim(), tone: t }))
    } catch {
      /* ignore quota errors */
    }
  }
  function changeDiscipline(v: string) {
    setDiscipline(v)
    persist(v, tone)
  }
  function changeTone(t: Tone) {
    setTone(t)
    persist(discipline, t)
  }

  function pickPath(p: Path) {
    setPath(p)
    setResult(null)
    setStep(2)
  }
  function done(r: PromoteResult) {
    setResult(r)
    setStep(3)
  }
  function jump(s: 1 | 2 | 3) {
    if (s >= step) return
    setStep(s)
    if (s === 1) {
      setPath(null)
      setResult(null)
    }
  }
  function restart() {
    setStep(1)
    setPath(null)
    setResult(null)
  }

  const lastLabel = path === 'video' ? 'Plan' : 'Post'

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="flex items-center gap-2 font-display text-[26px] font-medium tracking-tight text-[var(--text-primary)]">
              <Megaphone className="size-6 text-[var(--accent)]" />
              Promote
            </h1>
            <StepProgress current={step} lastLabel={lastLabel} onJump={jump} />
          </div>
          {step === 1 && (
            <p className="text-sm text-[var(--text-tertiary)]">We write it — you post it. Pick how you want to start.</p>
          )}
        </header>

        {step > 1 && (
          <button
            type="button"
            onClick={() => jump((step - 1) as 1 | 2 | 3)}
            className="inline-flex items-center gap-1 text-[13px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </button>
        )}

        {step === 2 && (
          <div className="flex flex-wrap items-end gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3">
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">
                <Dumbbell className="size-3" /> What you coach
              </label>
              <input
                value={discipline}
                onChange={(e) => changeDiscipline(e.target.value)}
                placeholder="e.g. Brazilian Jiu-Jitsu"
                maxLength={80}
                className="w-[220px] max-w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-quaternary)]">Tone</label>
              <ToneToggle value={tone} onChange={changeTone} />
            </div>
          </div>
        )}

        {step === 1 && <PathStep onPick={pickPath} />}
        {step === 2 && path === 'idea' && <IdeaStep discipline={discipline} tone={tone} onDone={done} />}
        {step === 2 && path === 'chat' && <ChatStep discipline={discipline} tone={tone} onDone={done} />}
        {step === 2 && path === 'video' && <VideoStep discipline={discipline} tone={tone} onDone={done} />}

        {step === 3 && result && (
          <div className="space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-5">
            {result.type === 'post' ? <PostCard post={result.post} /> : <VideoPlanCard plan={result.videoPlan} />}
            <ResultActions caption={result.type === 'post' ? fullCaption(result.post) : videoPlanCaption(result.videoPlan)} />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={restart}
                className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
              >
                <RotateCcw className="size-3.5" />
                Start over
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
