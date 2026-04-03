'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useLoginAuroraMotion } from '@/components/auth/useLoginAuroraMotion'

const COACH_FEATURES = [
  'Know which clients need attention today',
  'Get paid faster with smart invoicing',
  'Keep clients engaged between sessions',
] as const

type AnimatedLoginPageProps = {
  children: ReactNode
  /** Coach marketing bullets (bottom-left, lg+). Hidden for client portal login. */
  showCoachValueProp?: boolean
}

/**
 * Full-viewport aurora background + fixed chrome. Forces light `data-theme` on
 * `document.documentElement` while mounted so auth chrome stays consistent.
 */
export function AnimatedLoginPage({ children, showCoachValueProp = true }: AnimatedLoginPageProps) {
  const auroraRef = useRef<HTMLDivElement>(null)
  useLoginAuroraMotion(auroraRef)

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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: '16px',
      }}
    >
      <div ref={auroraRef} className="login-aurora login-aurora--driven" aria-hidden>
        <div className="blob-1" />
        <div className="blob-2" />
        <div className="blob-3" />
      </div>

      <div className="login-aurora-grain" aria-hidden />
      <div className="login-aurora-vignette" aria-hidden />

      <div
        style={{
          position: 'fixed',
          top: '24px',
          left: '28px',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '7px',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#3B9EE8' }}>C</span>
        </div>
        <span
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'white',
            letterSpacing: '-0.02em',
          }}
        >
          ClearPath
        </span>
      </div>

      {showCoachValueProp ? (
        <div
          style={{
            position: 'fixed',
            bottom: '40px',
            left: '40px',
            zIndex: 20,
            maxWidth: '320px',
            display: 'none',
          }}
          className="login-value-prop"
        >
          <p
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'white',
              lineHeight: 1.3,
              letterSpacing: '-0.03em',
              marginBottom: '12px',
            }}
          >
            &ldquo;Run your coaching business like a pro.&rdquo;
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {COACH_FEATURES.map((text) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: '9px', color: 'white' }}>✓</span>
                </div>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ position: 'relative', zIndex: 10 }}>{children}</div>
    </div>
  )
}

/** @deprecated Use `AnimatedLoginPage` — alias for spec / imports. */
export const FullScreenLoginLayout = AnimatedLoginPage
