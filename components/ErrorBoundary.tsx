'use client'

import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary] caught:', error)
    this.props.onError?.(error)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">
            <p className="mb-2 font-medium text-[var(--color-text-primary)]">Something went wrong</p>
            <p className="text-[13px] text-[var(--color-muted)]">Try refreshing the page</p>
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </Button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
