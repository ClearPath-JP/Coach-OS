'use client'

import { useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Called when the modal should close (e.g. backdrop click or close button) */
  onClose: () => void
  /** Title shown at the top of the modal */
  title: string
  /** Modal content */
  children: React.ReactNode
  /** Optional class for the card container */
  className?: string
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const getFocusableElements = useCallback(() => {
    if (!cardRef.current) return []
    return Array.from(
      cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => !el.hasAttribute('disabled'))
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusable = getFocusableElements()
    const preferredFirst =
      cardRef.current?.querySelector<HTMLElement>('input, textarea, select, [autofocus]') ?? null
    const first = preferredFirst ?? focusable[0]
    const last = focusable[focusable.length - 1]

    if (first) first.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return

      const current = document.activeElement as HTMLElement
      if (e.shiftKey) {
        if (current === first && last) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (current === last && first) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [isOpen, getFocusableElements])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex max-md:flex-col max-md:justify-end md:items-center md:justify-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(0,0,0,0.55)] backdrop-blur-[6px]"
        onClick={onClose}
        aria-label="Close modal"
        tabIndex={-1}
      />
      <div
        ref={cardRef}
        className={cn(
          'glass-modal relative z-10 flex max-h-[90vh] w-full flex-col overflow-y-auto',
          'border border-[var(--border-default)] bg-[var(--bg-app)] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_80px_rgba(159,18,57,0.04)]',
          'rounded-t-[14px] max-md:max-w-none md:mx-auto md:max-w-md md:rounded-[14px]',
          'p-5 max-md:pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]',
          className
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            id="modal-title"
            className="text-[var(--text-primary)] text-[18px] font-medium leading-[var(--leading-heading)]"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:shadow-[var(--focus-ring)]"
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 5L5 15M5 5l10 10" />
            </svg>
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
