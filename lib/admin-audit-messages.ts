/**
 * Human-readable audit log copy and risk classification for admin UI.
 */

export type AuditRiskLevel = 'high' | 'medium' | 'low'

export type AuditEventCategory = 'security' | 'payments' | 'data' | 'admin' | 'other'

export type AuditDisplayContext = {
  actorName?: string | null
  actorEmail?: string | null
  workspaceName?: string | null
  /** Target email (e.g. invited client, failed login) */
  targetEmail?: string | null
  amountCents?: number | null
  planLabel?: string | null
  coachLabel?: string | null
  ip?: string | null
}

export function classifyAuditRisk(action: string): AuditRiskLevel {
  const a = action.toLowerCase()
  if (a === 'login_failed' || a === 'suspicious_request') return 'high'
  if (
    a === 'password_changed' ||
    a === 'subscription_changed' ||
    a === 'file_uploaded' ||
    a.includes('suspend') ||
    a.includes('delete') ||
    a.includes('workspace.delete')
  ) {
    return 'medium'
  }
  return 'low'
}

export function classifyAuditCategory(action: string): AuditEventCategory {
  const a = action.toLowerCase()
  if (a === 'login' || a === 'login_failed' || a === 'suspicious_request' || a.includes('auth')) {
    return 'security'
  }
  if (
    a === 'invoice_paid' ||
    a === 'subscription_changed' ||
    a.includes('payment') ||
    a.includes('stripe') ||
    a.includes('subscription')
  ) {
    return 'payments'
  }
  if (
    a === 'client_invited' ||
    a === 'client_deleted' ||
    a === 'password_changed' ||
    a === 'file_uploaded'
  ) {
    return 'data'
  }
  if (a.startsWith('admin.') || a.includes('admin.')) return 'admin'
  return 'other'
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function displayName(ctx: AuditDisplayContext): string {
  if (ctx.actorName?.trim()) return ctx.actorName.trim()
  if (ctx.actorEmail?.trim()) return ctx.actorEmail.trim()
  return 'Someone'
}

/**
 * Short plain-English line + segments for bold emphasis in UI.
 */
export function formatAuditDescription(
  action: string,
  metadata: Record<string, unknown> | null | undefined,
  ctx: AuditDisplayContext
): { text: string; segments: Array<{ text: string; bold?: boolean }>; border: 'security' | 'payment' | 'default' } {
  const m = metadata ?? {}
  const metaEmail =
    typeof m.email === 'string'
      ? m.email
      : typeof m.invitedEmail === 'string'
        ? m.invitedEmail
        : typeof m.targetEmail === 'string'
          ? m.targetEmail
          : null
  const ip = ctx.ip ?? (typeof m.ip === 'string' ? m.ip : null)

  switch (action) {
    case 'login': {
      const name = displayName(ctx)
      return {
        text: `${name} signed in`,
        segments: [{ text: name, bold: true }, { text: ' signed in' }],
        border: 'default',
      }
    }
    case 'login_failed': {
      const where = metaEmail ?? ctx.targetEmail ?? ip ?? 'unknown address'
      return {
        text: `Failed login attempt from ${where}`,
        segments: [{ text: 'Failed login attempt from ' }, { text: String(where), bold: true }],
        border: 'security',
      }
    }
    case 'client_invited': {
      const coach = ctx.coachLabel ?? displayName(ctx)
      const invited = metaEmail ?? 'a client'
      return {
        text: `${coach} invited ${invited}`,
        segments: [{ text: coach, bold: true }, { text: ' invited ' }, { text: invited, bold: true }],
        border: 'default',
      }
    }
    case 'invoice_paid': {
      const payer = displayName(ctx)
      const coach = ctx.coachLabel ?? 'coach'
      const amt =
        typeof ctx.amountCents === 'number' && ctx.amountCents > 0
          ? money(ctx.amountCents)
          : 'a payment'
      return {
        text: `${payer} paid ${amt} (${coach})`,
        segments: [
          { text: payer, bold: true },
          { text: ' paid ' },
          { text: amt, bold: true },
          { text: ' to ' },
          { text: coach, bold: true },
        ],
        border: 'payment',
      }
    }
    case 'password_changed': {
      const name = displayName(ctx)
      return {
        text: `${name} changed their password`,
        segments: [{ text: name, bold: true }, { text: ' changed their password' }],
        border: 'default',
      }
    }
    case 'file_uploaded': {
      const name = displayName(ctx)
      return {
        text: `${name} uploaded a file`,
        segments: [{ text: name, bold: true }, { text: ' uploaded a file' }],
        border: 'default',
      }
    }
    case 'subscription_changed': {
      const coach = ctx.coachLabel ?? displayName(ctx)
      const plan = ctx.planLabel ?? (typeof m.plan === 'string' ? m.plan : 'a new plan')
      return {
        text: `${coach} plan changed to ${plan}`,
        segments: [{ text: coach, bold: true }, { text: ' plan changed to ' }, { text: plan, bold: true }],
        border: 'payment',
      }
    }
    case 'suspicious_request': {
      const from = ip ?? 'unknown IP'
      return {
        text: `Suspicious request blocked from ${from}`,
        segments: [{ text: 'Suspicious request blocked from ' }, { text: from, bold: true }],
        border: 'security',
      }
    }
    default: {
      if (action.startsWith('admin.')) {
        const human = action.replace(/^admin\./, '').replace(/\./g, ' ')
        return {
          text: `Admin: ${human}`,
          segments: [{ text: 'Admin: ' }, { text: human, bold: true }],
          border: 'default',
        }
      }
      return {
        text: action,
        segments: [{ text: action }],
        border: 'default',
      }
    }
  }
}

export function healthErrorMessage(serviceKey: string, ok: boolean, ms: number): string | null {
  if (ok && ms <= 500) return null
  if (!ok) {
    switch (serviceKey) {
      case 'database':
        return 'Cannot reach the database. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
      case 'auth':
        return 'Authentication service check failed. Verify Supabase project keys and Auth settings.'
      case 'storage':
        return 'File storage check failed. Confirm Supabase Storage is enabled and API keys are valid.'
      case 'redis':
        return 'Rate limiting is unavailable. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or expect in-memory limits only.'
      case 'stripe':
        return 'Stripe API check failed. Confirm STRIPE_SECRET_KEY and network access.'
      case 'resend':
        return 'Email provider check failed. Set RESEND_API_KEY to enable outbound mail.'
      default:
        return 'This check failed. See server logs for details.'
    }
  }
  if (ms > 500) {
    return `Response was slower than expected (${ms}ms). Consider investigating load or network latency.`
  }
  return null
}
