'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const FOUNDING_FEATURES = [
  'Unlimited clients',
  '50 GB video storage',
  'Client portal access',
  'Programs & assignments',
  'Invoicing & packages',
  'Real-time messaging + broadcast',
  'Schedule & calendar with iCal',
  'Analytics dashboard',
  'Google Drive video import',
  'White-label branding',
  'Goal tracking & check-ins',
  'Testimonial collection',
  'Priority support',
]

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0, marginTop: 2 }}
    >
      <path
        d="M3 8l3.5 3.5L13 4.5"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

interface Props {
  userEmail: string
}

export function SubscribePageContent({ userEmail }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCheckout() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/billing/new-coach-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan: 'founding' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      const url = json.data?.url
      if (typeof url === 'string' && url) {
        router.push(url)
      } else {
        setError('Could not start checkout. Please try again.')
        setLoading(false)
      }
    } catch {
      setError('Something went wrong — check your connection and try again.')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 24px 80px',
      }}
    >
      {/* Wordmark */}
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '0.01em',
            color: 'var(--text-primary)',
            lineHeight: 1,
          }}
        >
          COACH<span style={{ color: 'var(--accent)' }}>OS</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6 }}>
          Built for coaches. Designed for growth.
        </p>
      </div>

      {/* Heading */}
      <div style={{ textAlign: 'center', maxWidth: 600, marginBottom: 40 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(26px, 4vw, 40px)',
            fontWeight: 500,
            letterSpacing: '0.01em',
            color: 'var(--text-primary)',
            lineHeight: 1.15,
            margin: '0 0 16px',
          }}
        >
          Become a Founding Member
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
          Lock in $99/month for life. No setup fee. Full platform access.
        </p>
        {userEmail && (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 8 }}>
            Signing up as <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{userEmail}</strong>
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          style={{
            background: 'color-mix(in srgb, var(--error) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)',
            borderRadius: 10,
            padding: '12px 16px',
            fontSize: 14,
            color: 'var(--error)',
            maxWidth: 480,
            marginBottom: 32,
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}

      {/* Founding Member Card */}
      <div
        className="card-glow"
        style={{
          background: 'var(--bg-subtle)',
          border: '2px solid var(--accent)',
          borderRadius: 16,
          padding: '40px 32px',
          maxWidth: 440,
          width: '100%',
          position: 'relative',
          boxShadow: '0 0 40px rgba(159, 18, 57, 0.1), 0 0 80px rgba(159, 18, 57, 0.05)',
        }}
      >
        {/* Badge */}
        <div
          style={{
            position: 'absolute',
            top: -14,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            padding: '4px 14px',
            borderRadius: 20,
            whiteSpace: 'nowrap',
          }}
        >
          Founding Member
        </div>

        {/* Price */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span
            style={{
              fontSize: 48,
              fontWeight: 800,
              letterSpacing: '-0.04em',
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}
          >
            $99
          </span>
          <span
            style={{
              fontSize: 15,
              color: 'var(--text-secondary)',
              fontWeight: 500,
              paddingBottom: 6,
            }}
          >
            /mo
          </span>
        </div>

        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--accent)', margin: '0 0 4px', fontWeight: 500 }}>
          Locked-in rate for life. No setup fee.
        </p>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 28px' }}>
          Only 10 founding spots available.
        </p>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border-default)', marginBottom: 24 }} />

        {/* Features */}
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '0 0 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {FOUNDING_FEATURES.map((f) => (
            <li
              key={f}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                fontSize: 14,
                color: 'var(--text-secondary)',
                lineHeight: 1.4,
              }}
            >
              <CheckIcon />
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          type="button"
          disabled={loading}
          onClick={handleCheckout}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.opacity = '0.88' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
        >
          {loading ? (
            <>
              <Spinner />
              Redirecting…
            </>
          ) : (
            'Get started — $99/month'
          )}
        </button>
      </div>

      {/* Footer note */}
      <p
        style={{
          marginTop: 40,
          fontSize: 13,
          color: 'var(--text-tertiary)',
          textAlign: 'center',
        }}
      >
        No setup fees. Cancel anytime. Billed monthly.
      </p>
    </div>
  )
}
