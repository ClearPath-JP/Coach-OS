'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Plan = 'starter' | 'pro' | 'scale'

interface PlanConfig {
  id: Plan
  badge: string
  name: string
  price: number
  tagline: string
  features: string[]
  popular: boolean
}

const PLANS: PlanConfig[] = [
  {
    id: 'starter',
    badge: 'STARTER',
    name: 'Starter',
    price: 69,
    tagline: 'For coaches just getting started',
    popular: false,
    features: [
      'Up to 15 clients',
      'Client portal & messaging',
      'Session notes & programs',
      'Goal & progress tracking',
      'Schedule & calendar',
      'Invoicing & packages',
      '10 GB video storage',
      'Email support',
    ],
  },
  {
    id: 'pro',
    badge: 'PRO',
    name: 'Pro',
    price: 129,
    tagline: 'For coaches ready to scale',
    popular: true,
    features: [
      'Everything in Starter',
      'Unlimited clients',
      'Advanced analytics',
      '50 GB video storage',
      'Daily check-ins',
      'Priority support',
    ],
  },
  {
    id: 'scale',
    badge: 'SCALE',
    name: 'Scale',
    price: 199,
    tagline: 'For elite coaches & teams',
    popular: false,
    features: [
      'Everything in Pro',
      'White-label client portal',
      '200 GB video storage',
      'Custom branding',
      'Priority onboarding call',
    ],
  },
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
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSelectPlan(plan: Plan) {
    setError(null)
    setLoadingPlan(plan)
    try {
      const res = await fetch('/api/billing/new-coach-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Something went wrong. Please try again.')
        setLoadingPlan(null)
        return
      }
      const url = json.data?.url
      if (typeof url === 'string' && url) {
        router.push(url)
      } else {
        setError('Could not start checkout. Please try again.')
        setLoadingPlan(null)
      }
    } catch {
      setError('Something went wrong — check your connection and try again.')
      setLoadingPlan(null)
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
          ClearPath<span style={{ color: 'var(--accent)' }}>OS</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6 }}>
          Built for coaches. Designed for growth.
        </p>
      </div>

      {/* Heading */}
      <div style={{ textAlign: 'center', maxWidth: 600, marginBottom: 52 }}>
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
          Choose the right plan for your coaching business
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
          Join coaches growing their practice with COACH-OS
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

      {/* Plan cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
          width: '100%',
          maxWidth: 1100,
        }}
      >
        {PLANS.map((plan) => (
          <div key={plan.id} style={{ position: 'relative' }}>
            {/* Most Popular chip */}
            {plan.popular && (
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
                  zIndex: 1,
                }}
              >
                Most Popular
              </div>
            )}

            <div
              style={{
                background: 'var(--bg-subtle)',
                border: plan.popular
                  ? '2px solid var(--accent)'
                  : '1px solid var(--border-default)',
                borderRadius: 16,
                padding: '32px 28px',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
              }}
            >
              {/* Badge */}
              <div
                style={{
                  display: 'inline-block',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: plan.popular ? 'var(--accent)' : 'var(--text-tertiary)',
                  background: plan.popular
                    ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                    : 'color-mix(in srgb, var(--border-default) 60%, transparent)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  marginBottom: 20,
                  alignSelf: 'flex-start',
                }}
              >
                {plan.badge}
              </div>

              {/* Price */}
              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                <span
                  style={{
                    fontSize: 48,
                    fontWeight: 800,
                    letterSpacing: '-0.04em',
                    color: 'var(--text-primary)',
                    lineHeight: 1,
                  }}
                >
                  ${plan.price}
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

              {/* Tagline */}
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                  margin: '0 0 24px',
                  lineHeight: 1.5,
                }}
              >
                {plan.tagline}
              </p>

              {/* Divider */}
              <div
                style={{
                  height: 1,
                  background: 'var(--border-default)',
                  marginBottom: 24,
                }}
              />

              {/* Features */}
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '0 0 32px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  flex: 1,
                }}
              >
                {plan.features.map((feature) => (
                  <li
                    key={feature}
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
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA button */}
              <button
                type="button"
                disabled={loadingPlan !== null}
                onClick={() => handleSelectPlan(plan.id)}
                style={{
                  width: '100%',
                  height: 48,
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: loadingPlan !== null ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'opacity 0.15s',
                  opacity: loadingPlan !== null && loadingPlan !== plan.id ? 0.5 : 1,
                  background: plan.popular ? 'var(--accent)' : 'transparent',
                  color: plan.popular ? '#fff' : 'var(--text-primary)',
                  border: plan.popular ? 'none' : '1.5px solid var(--border-default)',
                }}
                onMouseEnter={(e) => {
                  if (loadingPlan !== null) return
                  if (plan.popular) {
                    e.currentTarget.style.opacity = '0.88'
                  } else {
                    e.currentTarget.style.background = 'var(--bg-emphasis)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = loadingPlan !== null && loadingPlan !== plan.id ? '0.5' : '1'
                  if (!plan.popular) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                {loadingPlan === plan.id ? (
                  <>
                    <Spinner />
                    Redirecting…
                  </>
                ) : (
                  'Get started'
                )}
              </button>
            </div>
          </div>
        ))}
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
