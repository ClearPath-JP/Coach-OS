'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { AuthBrandWordmark } from '@/components/auth/AuthBrandWordmark'
import { AuthMarketingHeroPanel } from '@/components/auth/AuthMarketingHeroPanel'
import { useLoginAuroraMotion } from '@/components/auth/useLoginAuroraMotion'
import { cn } from '@/lib/utils'

type AnimatedLoginPageProps = {
  children: ReactNode
  /**
   * `split` — marketing + aurora on the left, form panel on the right (lg+).
   * `fullscreen` — centered card on full aurora (e.g. client portal).
   */
  layout?: 'split' | 'fullscreen'
  /** Coach login: white form column, no card shadow, spec typography (see globals `.coach-login-split-panel`). */
  splitShellVariant?: 'default' | 'coach'
}

/**
 * Auth shell: animated aurora, optional split layout, light `data-theme` on `html`.
 */
export function AnimatedLoginPage({
  children,
  layout = 'split',
  splitShellVariant = 'default',
}: AnimatedLoginPageProps) {
  const auroraRef = useRef<HTMLDivElement>(null)
  useLoginAuroraMotion(auroraRef)
  const split = layout === 'split'
  const coachShell = split && splitShellVariant === 'coach'

  useEffect(() => {
    const root = document.documentElement
    const prevTheme = root.getAttribute('data-theme')
    root.setAttribute('data-auth-aurora', 'true')
    root.setAttribute('data-theme', 'light')
    return () => {
      root.removeAttribute('data-auth-aurora')
      if (prevTheme != null) {
        root.setAttribute('data-theme', prevTheme)
      } else {
        root.removeAttribute('data-theme')
      }
    }
  }, [])

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      <div
        className={cn('login-auth-motion-layer', split && 'login-auth-motion-layer--split')}
        aria-hidden
      >
        <div ref={auroraRef} className="login-aurora login-aurora--driven">
          <div className="blob-1" />
          <div className="blob-2" />
          <div className="blob-3" />
        </div>
        <div className="login-aurora-grain" />
        <div className="login-aurora-vignette" />
      </div>

      {split ? (
        <div
          className={cn(
            'pointer-events-none fixed inset-0 z-[4] hidden lg:left-0 lg:top-0 lg:bottom-0 lg:block',
            coachShell ? 'lg:right-[520px]' : 'lg:right-[480px]'
          )}
        >
          <AuthMarketingHeroPanel />
        </div>
      ) : null}

      <div
        className={cn(
          'fixed left-7 top-6 z-20',
          split && 'lg:hidden'
        )}
      >
        <AuthBrandWordmark tone="on-dark" size="sm" />
      </div>

      <div
        className={cn(
          'relative z-10',
          split &&
            cn(
              'flex min-h-screen flex-col justify-center px-4 py-10 lg:grid lg:min-h-screen lg:items-stretch lg:justify-normal lg:px-0 lg:py-0',
              coachShell ? 'lg:grid-cols-[1fr_520px]' : 'lg:grid-cols-[1fr_480px]'
            ),
          !split && 'flex min-h-screen items-center justify-center px-4 py-12'
        )}
      >
        {split ? <div className="hidden min-h-screen lg:block" aria-hidden /> : null}

        <div
          className={cn(
            'mx-auto w-full max-w-[440px]',
            split &&
              (coachShell
                ? 'auth-split-form-panel coach-login-split-panel flex flex-col justify-center lg:mx-0 lg:max-w-none lg:min-h-screen'
                : 'auth-split-form-panel flex flex-col justify-center lg:mx-0 lg:max-w-none lg:min-h-screen lg:border-l lg:border-[#E8EEF4] lg:bg-[#FAFBFC] lg:px-10 lg:py-16')
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/** @deprecated Use `AnimatedLoginPage` — alias for spec / imports. */
export const FullScreenLoginLayout = AnimatedLoginPage
