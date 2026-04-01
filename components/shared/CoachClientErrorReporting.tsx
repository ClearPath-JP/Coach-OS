'use client'

import { Component, type ErrorInfo, type ReactNode, useEffect } from 'react'
import { reportFrontendError } from '@/lib/report-frontend-error'

type BoundaryProps = {
  children: ReactNode
}

type BoundaryState = { hasError: boolean }

/**
 * Catches React render/lifecycle errors in coach or client trees and reports to /api/error-report.
 */
export class CoachClientErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false }

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const payload: Parameters<typeof reportFrontendError>[0] = {
      message: error.message || 'React error',
      source: 'react',
    }
    if (error.stack) payload.stack = error.stack
    if (info.componentStack) payload.componentStack = info.componentStack
    if (typeof window !== 'undefined') payload.routePath = window.location.pathname
    void reportFrontendError(payload)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-md p-8 text-center">
          <h1 className="text-lg font-medium text-[var(--text-primary)]">Something went wrong</h1>
          <p className="mt-2 text-sm text-[var(--text-tertiary)]">
            This page hit an unexpected error. You can try refreshing. Your coach has been notified if error reporting
            is enabled.
          </p>
          <button
            type="button"
            className="mt-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-4 py-2 text-sm font-medium"
            onClick={() => window.location.reload()}
          >
            Refresh page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function useWindowErrorReporting(): void {
  useEffect(() => {
    const onError = (ev: ErrorEvent) => {
      const msg = ev.message || 'Script error'
      const p: Parameters<typeof reportFrontendError>[0] = {
        message: msg,
        routePath: window.location.pathname,
        source: 'window',
      }
      if (ev.error?.stack) p.stack = ev.error.stack
      void reportFrontendError(p)
    }
    const onRejection = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : 'Unhandled promise rejection'
      const p: Parameters<typeof reportFrontendError>[0] = {
        message,
        routePath: window.location.pathname,
        source: 'unhandledrejection',
      }
      if (reason instanceof Error && reason.stack) p.stack = reason.stack
      void reportFrontendError(p)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
}

export function CoachClientErrorReportingShell({ children }: { children: ReactNode }) {
  useWindowErrorReporting()
  return <CoachClientErrorBoundary>{children}</CoachClientErrorBoundary>
}
