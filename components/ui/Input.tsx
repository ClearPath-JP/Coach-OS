'use client'

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const inputTransition =
  'transition-[border-color,box-shadow] duration-[var(--duration-fast)] [transition-timing-function:var(--ease-out)]'

const inputBase = cn(
  'w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--bg-subtle)]',
  'px-3 font-normal text-[length:var(--text-14)] leading-[var(--leading-normal)] text-[var(--text-primary)] [font-family:var(--font)]',
  'placeholder:text-[var(--text-quaternary)]',
  inputTransition,
  'hover:border-[var(--border-strong)]',
  'focus:border-[var(--accent)] focus:outline-none focus:shadow-[0_0_0_3px_var(--cp-focus-ring)]',
  'disabled:cursor-not-allowed disabled:bg-[var(--bg-subtle)] disabled:text-[var(--text-tertiary)]'
)

const inputError = cn(
  'border-[var(--error)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--error)_10%,transparent)]',
  'focus:border-[var(--error)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--error)_10%,transparent)]'
)

export type InputSize = 'sm' | 'md' | 'lg'

const inputHeights: Record<InputSize, string> = {
  sm: 'h-8 min-h-8',
  md: 'h-9 min-h-9',
  lg: 'h-10 min-h-10',
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  errorMessage?: string | undefined
  inputSize?: InputSize
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, errorMessage, inputSize = 'md', ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(inputBase, inputHeights[inputSize], error && inputError, className)}
          {...props}
        />
        {error && errorMessage && (
          <p className="mt-1 text-[13px] text-[var(--error)]">{errorMessage}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
  errorMessage?: string | undefined
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, errorMessage, ...props }, ref) => {
    return (
      <div className="w-full">
        <textarea
          ref={ref}
          className={cn(
            inputBase,
            'min-h-20 resize-y py-2.5',
            error && inputError,
            className
          )}
          {...props}
        />
        {error && errorMessage && (
          <p className="mt-1 text-[13px] text-[var(--error)]">{errorMessage}</p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export { Input, Textarea }
